import ndk from '$lib/stores/ndk';
import NDK, {
    NDKCashuMintList,
    NDKKind,
    NDKUser,
    type CashuPaymentInfo,
    type Hexpubkey,
    type NDKFilter,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';
import {
    type MintUrl,
    type NDKCashuMintRecommendation,
    type NDKCashuWallet,
} from '@nostr-dev-kit/ndk-wallet';
import type { ToastSettings, ToastStore } from '@skeletonlabs/skeleton';
import { get } from 'svelte/store';
import { broadcastEvent, getCashuPaymentInfo } from '$lib/utils/helpers';
import { wallet } from '$lib/wallet/wallet';
import currentUser from '$lib/stores/user';
import { encryptSecret } from '$lib/utils/crypto';
import type { Proof } from '@cashu/cashu-ts';

// This method checks if user's cashu mint list event (kind: 10019) is synced with user's selected cashu wallet
export async function isCashuMintListSynced(
    ndkCashuWallet: NDKCashuWallet,
    ndkUser: NDKUser,
    toastStore: ToastStore
) {
    let respondedToAction = false;

    // Fetch Cashu payment info for logged in user
    const info = await getCashuPaymentInfo(ndkUser.pubkey);

    // if cashu mint info is not found, display a toast with action button to publish mint list
    if (!info) {
        const t: ToastSettings = {
            message:
                'Could not find List of preferred Mints. Would you like to publish preferred List based on CashuWallet?',
            background: 'bg-warning-300-600-token',
            autohide: false,
            action: {
                label: 'Publish',
                response: () => {
                    respondedToAction = true;
                    publishCashuMintList(ndkCashuWallet)
                        .then(() => {
                            toastStore.trigger({
                                message: `Successfully published Cashu Mint List`,
                                timeout: 5000,
                                autohide: true,
                                background: `bg-success-300-600-token`,
                            });
                        })
                        .catch((err) => {
                            toastStore.trigger({
                                message: `Failed to publish Cashu Mint List!`,
                                autohide: false,
                                background: `bg-error-300-600-token`,
                            });
                        });
                },
            },
            callback: (res) => {
                if (res.status === 'closed' && !respondedToAction) {
                    toastStore.trigger({
                        message: `You'll not be able to receive ecash payments`,
                        autohide: false,
                        background: `bg-warning-300-600-token`,
                    });
                }
            },
        };
        toastStore.trigger(t);
        return;
    }

    const p2pk = await ndkCashuWallet.getP2pk();

    // if p2pk from cashu payment info does match with p2pk from cashu wallet
    // display a toast with action button to sync the keys
    if (info.p2pk !== p2pk) {
        const t: ToastSettings = {
            message:
                'Nutzap-Pubkey from Cashu payment info event does not match with Pubkey in wallet. It is recommended to sync them.',
            background: 'bg-warning-300-600-token',
            autohide: false,
            action: {
                label: 'Sync',
                response: () => {
                    respondedToAction = true;
                    syncP2pk(ndkCashuWallet, info)
                        .then(() => {
                            toastStore.trigger({
                                message: `Successfully updated Pubkey  mint list`,
                                timeout: 5000,
                                autohide: true,
                                background: `bg-success-300-600-token`,
                            });
                        })
                        .catch((err) => {
                            toastStore.trigger({
                                message: `Failed to update cashu mint list!`,
                                autohide: false,
                                background: `bg-error-300-600-token`,
                            });
                        });
                },
            },
            callback: (res) => {
                if (res.status === 'closed' && !respondedToAction) {
                    toastStore.trigger({
                        message: `You'll not be able to receive ecash payments`,
                        autohide: false,
                        background: `bg-warning-300-600-token`,
                    });
                }
            },
        };
        toastStore.trigger(t);
        return;
    }
}

// This function publishes cashu mint list event based on cashu wallet
export async function publishCashuMintList(ndkCashuWallet: NDKCashuWallet) {
    const $ndk = get(ndk);
    const p2pk = await ndkCashuWallet.getP2pk();

    const ndkMintList = new NDKCashuMintList($ndk);
    ndkMintList.relays = ndkCashuWallet.relaySet!.relayUrls;
    ndkMintList.mints = ndkCashuWallet.mints;
    ndkMintList.p2pk = p2pk;

    return broadcastEvent($ndk, ndkMintList, {replaceable: true});
}

export async function syncP2pk(ndkCashuWallet: NDKCashuWallet, cashuPaymentInfo: CashuPaymentInfo) {
    const $ndk = get(ndk);
    const p2pk = await ndkCashuWallet.getP2pk();

    const ndkMintList = new NDKCashuMintList($ndk);
    ndkMintList.relays = cashuPaymentInfo.relays!;
    ndkMintList.mints = cashuPaymentInfo.mints!;
    ndkMintList.p2pk = p2pk;

    return broadcastEvent($ndk, ndkMintList, {replaceable: true});
}

export interface WalletStorage {
  version: string;
  user: string;
  wallet: Record<string, Proof[]>;
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
        typeof value.user === 'string' &&
        isProofMap(value.wallet)
    );
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

    const mintsWithProofs = $wallet.state.getMintsProofs();

    const json:WalletStorage = {
        version: '2.0',
        user: $currentUser.pubkey,
        wallet: Object.fromEntries(mintsWithProofs.entries()),
    };

    const stringified = JSON.stringify(json, null, 2);

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

export async function getCashuMintRecommendations(ndk: NDK, $wot: Set<string>) {
    const res: NDKCashuMintRecommendation = {};

    const mintListFilter: NDKFilter = { kinds: [NDKKind.CashuMintList] };
    const mintListRecommendations = await ndk.fetchEvents(mintListFilter);
    for (const event of mintListRecommendations) {
        // Skip events if the publisher is not in the Web of Trust ($wot)
        if (!$wot.has(event.pubkey)) continue;

        // Extract "mint" tags from the event
        for (const mintTag of event.getMatchingTags('mint')) {
            const url = mintTag[1];
            if (!url) continue; // Skip if URL is not present

            // Aggregate events and pubkeys by URL
            const entry = res[url] || { events: [], pubkeys: new Set() };
            entry.events.push(event);
            entry.pubkeys.add(event.pubkey);
            res[url] = entry; // Update the result object
        }
    }

    // If we have at least 5 recommendations, return early
    if (Object.entries(res).length >= 5) {
        return sortRecommendations(res);
    }

    const mintRecommendationFilter: NDKFilter = {
        kinds: [NDKKind.EcashMintRecommendation],
    };
    const mintRecommendations = await ndk.fetchEvents(mintRecommendationFilter);
    for (const event of mintRecommendations) {
        // Skip events if the publisher is not in the Web of Trust ($wot)
        if (!$wot.has(event.pubkey)) continue;

        // Extract "u" tags representing URLs and filter for Cashu-specific recommendations
        for (const uTag of event.getMatchingTags('u')) {
            if (uTag[2] && uTag[2] !== 'cashu') continue; // Skip if not related to Cashu

            const url = uTag[1];
            if (!url) continue; // Skip if URL is not present

            // Aggregate events and pubkeys by URL
            const entry = res[url] || { events: [], pubkeys: new Set() };
            entry.events.push(event);
            entry.pubkeys.add(event.pubkey);
            res[url] = entry; // Update the result object
        }
    }

    // Sort the final recommendations by the number of unique pubkeys in descending order
    return sortRecommendations(res);
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
function sortRecommendations(recommendations: NDKCashuMintRecommendation) {
    return Object.fromEntries(
        Object.entries(recommendations).sort((a, b) => b[1].pubkeys.size - a[1].pubkeys.size)
    );
}
