import NDK, {
    NDKKind,
    NDKRelaySet,
    NDKSubscriptionCacheUsage,
    type Hexpubkey,
    type NDKEvent,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';
import {
    NDKNutzapMonitor,
    type MintUrl,
    type MintUsage,
    type NDKCashuWallet,
} from '@nostr-dev-kit/ndk-wallet';
import { wallet } from '$lib/wallet/wallet';
import { consolidateMintTokens } from '@nostr-dev-kit/ndk-wallet';
import { get } from 'svelte/store';
import currentUser from '$lib/stores/user';
import { encryptSecret } from '$lib/utils/crypto';
import type { Proof } from '@cashu/cashu-ts';

export const WALLET_BACKUP_VERSION = '2.0';

export async function recoverWallet(
    walletStorage: WalletStorage,
    wallet: NDKCashuWallet,
    nutzapMonitor: NDKNutzapMonitor
) {
    
    const cashuKeys = walletStorage.cashuKeys;
    for (const [p2pk, privkey] of Object.entries(cashuKeys)) {
        if (privkey) {
            await wallet.addPrivkey(privkey);
        }
    }

    // This will add any missing privkeys to Nutzap Monitor
    nutzapMonitor.wallet = wallet;

    const proofsMap = new Map(
        Object.entries(walletStorage.mintsWithProofs)
    );

    for (const [mint, proofs] of proofsMap.entries()) {
        await consolidateMintTokens(mint, wallet, proofs);
    }
}

export interface WalletStorage {
    version: string;
    // Privkey is randomly generated and so not related to nostr key
    // so we back that up too to be able to fully reconstruct the wallet if needed
    // Multiple keys can be generated for unconventional NWC wallets
    cashuKeys: Record<string, string|null>;
    mintsWithProofs: Record<string, Proof[]>;
}

export function parseAndValidateBackup(
    jsonString: string
): WalletStorage | null {
    try {
        const parsed = JSON.parse(jsonString) as WalletStorage;

        if (isValidBackup(parsed)) {
            console.log('Validation successful:', parsed);
            return parsed;
        } else {
            console.error('Validation failed: Object structure does not match the schema.');
            return null;
        }
    } catch (error) {
        console.error('Invalid JSON format:', error);
        return null;
    }
}

export function isValidBackup(value: WalletStorage): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof value.version === 'string' &&
        checkCashuKeys(value.cashuKeys) &&
        isProofMap(value.mintsWithProofs)
    );
}

function checkCashuKeys(candidate: Record<string, string|null>): boolean {
    for (const [key, value] of Object.entries(candidate)) {
        // console.warn(`cashuKey: [${key}]:[${value}]`)
        if (typeof key !== 'string') {
            console.error(`Error: Type of key is NOT string but ${typeof key}!`)
            return false;
        }
        if (
            typeof value !== 'string' && 
                value !== null
        ) {
            console.error(
                `Error: Value of cashu key NOT NULL and its type is NOT string` +
                ` but ${typeof value}! (${typeof value !== 'string'})` +
                `  || (${value !== null})`
            );
            return false;
        }
    }

    return true;
}

function isProofMap(candidate: Record<string, Proof[]>): boolean {
    try {
        for (const [key, value] of Object.entries(candidate)) {
            if (typeof key !== 'string') return false;
            if (!isProofArray(value)) return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}

function isProofArray(arr: unknown): arr is Proof[] {
  if (!Array.isArray(arr)) return false;
  
  return arr.every(item => isProof(item));
}

function isProof(obj: unknown): obj is Proof {
  if (!obj || typeof obj !== 'object') return false;
  
  const candidate = obj as Partial<Proof>;
  
  if (typeof candidate.id !== 'string') return false;
  if (typeof candidate.amount !== 'number') return false;
  if (typeof candidate.secret !== 'string') return false;
  if (typeof candidate.C !== 'string') return false;
  
  return true;
}

export async function backupWallet(
    encrypted?: boolean,
    passphrase?: string
) {
    const $currentUser = get(currentUser);
    const $wallet = get(wallet);
    
    if (!$currentUser || !$wallet) return;

    const stringified = serializeWallet(toWalletStorage($wallet));

    if (encrypted) {
        if (!passphrase || passphrase.length < 14) {
            throw new Error('minimum 14 chars are required for passphrase');
        }

        // we'll use pubkey of current user as salt for encryption
        const salt = $currentUser!.pubkey;

        const cipherData = encryptSecret(stringified, passphrase, salt);
        saveToFile(cipherData, true);
    } else {
        saveToFile(stringified);
    }
}

export function toWalletStorage(wallet: NDKCashuWallet): WalletStorage {
    const mintsWithProofs = wallet.state.getMintsProofs();
    const cashuKeys: Record<string, string | null> = {};
    for (const [p2pk, signer] of wallet.privkeys.entries()) {
        cashuKeys[p2pk] = signer.privateKey || null;
    }

    const ws:WalletStorage = {
        version: WALLET_BACKUP_VERSION,
        cashuKeys,
        mintsWithProofs: Object.fromEntries(mintsWithProofs.entries()),
    };

    return ws;
}

export function serializeWallet(walletStorage: WalletStorage) {
    return JSON.stringify(walletStorage, null, 2);
}

const RECOMMENDATION_FETCH_TIMEOUT_MS = 5000;

type MintEndorsementType = 'explicit' | 'nutzap';

export type MintEndorsementTypes = {
    explicit: boolean;
    nutzap: boolean;
};

export type MintRecommendationUsage = MintUsage & {
    endorsementsByPubkey: Map<Hexpubkey, MintEndorsementTypes>;
};

export type CashuMintRecommendations = Record<MintUrl, MintRecommendationUsage>;

export async function getCashuMintRecommendations(
    ndk: NDK,
    $wot: Set<string>
): Promise<CashuMintRecommendations> {
    const res: CashuMintRecommendations = {};

    const mintFilters: NDKFilter[] = [
        { kinds: [NDKKind.EcashMintRecommendation] },
        { kinds: [NDKKind.CashuMintList] },
    ];

    const relaySet = getConnectedRelaySet(ndk);
    const mintRecommendations = await fetchEventsWithTimeout(
        ndk.fetchEvents(
            mintFilters,
            {
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
                closeOnEose: true,
                groupable: false,
            },
            relaySet
        ),
        RECOMMENDATION_FETCH_TIMEOUT_MS
    );

    for (const event of mintRecommendations) {
        if (!$wot.has(event.pubkey)) continue;

        switch (event.kind) {
            case NDKKind.CashuMintList:
                for (const mintTag of event.getMatchingTags('mint')) {
                    const url = mintTag[1];
                    if (!url) continue;

                    registerEndorsement(res, url, event, 'nutzap');
                }
                break;
            case NDKKind.EcashMintRecommendation:
                for (const uTag of event.getMatchingTags('u')) {
                    if (uTag[2] && uTag[2] !== 'cashu') continue;

                    const url = uTag[1];
                    if (!url) continue;

                    registerEndorsement(res, url, event, 'explicit');
                }
                break;
        }
    }

    return sortRecommendations(res);
}

function registerEndorsement(
    recommendations: CashuMintRecommendations,
    url: MintUrl,
    event: NDKEvent,
    endorsementType: MintEndorsementType
) {
    const entry = recommendations[url] || {
        events: [],
        pubkeys: new Set<Hexpubkey>(),
        endorsementsByPubkey: new Map<Hexpubkey, MintEndorsementTypes>(),
    };

    entry.events.push(event);
    entry.pubkeys.add(event.pubkey);

    const current = entry.endorsementsByPubkey.get(event.pubkey) || {
        explicit: false,
        nutzap: false,
    };

    if (endorsementType === 'explicit') {
        current.explicit = true;
    } else {
        current.nutzap = true;
    }

    entry.endorsementsByPubkey.set(event.pubkey, current);
    recommendations[url] = entry;
}

async function fetchEventsWithTimeout(
    promise: Promise<Set<NDKEvent>>,
    timeoutMs: number
): Promise<Set<NDKEvent>> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    const timeoutPromise = new Promise<Set<NDKEvent>>((resolve) => {
        timeoutId = setTimeout(() => {
            timedOut = true;
            resolve(new Set());
        }, timeoutMs);
    });

    const result = await Promise.race([promise, timeoutPromise]);

    if (timeoutId) clearTimeout(timeoutId);

    if (timedOut) {
        console.warn(`Cashu mint recommendation fetch timed out after ${timeoutMs}ms.`);
    }

    return result;
}

function getConnectedRelaySet(ndk: NDK) {
    const relays = Array.from(ndk.pool?.relays?.values() ?? []);
    const relayUrls = relays
        .filter((relay) => ('connected' in relay ? relay.connected : true))
        .map((relay) => relay.url);

    if (relayUrls.length === 0) return undefined;

    return NDKRelaySet.fromRelayUrls(relayUrls, ndk);
}

// Function to save encrypted content to a file
function saveToFile(content: string, isEncrypted = false) {
    const filename = `wallet-backup.${isEncrypted ? 'enc' : 'json'}`;
    const mimeType = isEncrypted ? 'application/octet-stream' : 'application/json';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Create a link element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
}

// Helper function to sort recommendations by the count of unique pubkeys
function sortRecommendations(recommendations: CashuMintRecommendations) {
    return Object.fromEntries(
        Object.entries(recommendations).sort((a, b) => b[1].pubkeys.size - a[1].pubkeys.size)
    );
}
