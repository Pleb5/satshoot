import ndk from '$lib/stores/ndk';
import {
    NDKCashuMintList,
    NDKEvent,
    NDKKind,
    NDKUser,
    type CashuPaymentInfo,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';
import { NDKCashuToken, type NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
import type { ToastSettings, ToastStore } from '@skeletonlabs/skeleton';
import { get } from 'svelte/store';
import { getCashuPaymentInfo } from './helpers';
import { isNostrEvent } from './misc';
import { CashuMint, CashuWallet, type Proof } from '@cashu/cashu-ts';
import { cashuTokensBackup, unsavedProofsBackup } from '$lib/stores/wallet';
import currentUser from '$lib/stores/user';

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
                'Could not found CashuMintList Event. Would you like to publish based on CashuWallet?',
            background: 'bg-warning-300-600-token',
            autohide: false,
            action: {
                label: 'Publish',
                response: () => {
                    respondedToAction = true;
                    publishCashuMintList(ndkCashuWallet)
                        .then(() => {
                            toastStore.trigger({
                                message: `Successfully published cashu mint list`,
                                timeout: 5000,
                                autohide: true,
                                background: `bg-success-300-600-token`,
                            });
                        })
                        .catch((err) => {
                            toastStore.trigger({
                                message: `Failed to publish cashu mint list!`,
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
                'p2pk in cashu mint list does not match with p2pk in cashu wallet. Would you like to sync them?',
            background: 'bg-warning-300-600-token',
            autohide: false,
            action: {
                label: 'Sync',
                response: () => {
                    respondedToAction = true;
                    syncP2pk(ndkCashuWallet, info)
                        .then(() => {
                            toastStore.trigger({
                                message: `Successfully updated cashu mint list`,
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
    ndkMintList.relays = ndkCashuWallet.relays;
    ndkMintList.mints = ndkCashuWallet.mints;
    ndkMintList.p2pk = p2pk;

    return ndkMintList.publishReplaceable();
}

export async function syncP2pk(ndkCashuWallet: NDKCashuWallet, cashuPaymentInfo: CashuPaymentInfo) {
    const $ndk = get(ndk);
    const p2pk = await ndkCashuWallet.getP2pk();

    const ndkMintList = new NDKCashuMintList($ndk);
    ndkMintList.relays = cashuPaymentInfo.relays;
    ndkMintList.mints = cashuPaymentInfo.mints;
    ndkMintList.p2pk = p2pk;

    return ndkMintList.publishReplaceable();
}

export function isValidBackup(value: any): value is { wallet: NostrEvent; tokens: NostrEvent[] } {
    return (
        typeof value === 'object' &&
        value !== null &&
        isNostrEvent(value.wallet) &&
        Array.isArray(value.tokens) &&
        value.tokens.every(isNostrEvent)
    );
}

export function parseAndValidateBackup(
    jsonString: string
): { wallet: NostrEvent; tokens: NostrEvent[] } | null {
    try {
        const parsed = JSON.parse(jsonString);

        if (isValidBackup(parsed)) {
            console.log('Validation successful:', parsed);
            return parsed; // Return the validated object if successful
        } else {
            console.error('Validation failed: Object structure does not match the schema.');
            return null;
        }
    } catch (error) {
        console.error('Invalid JSON format:', error);
        return null;
    }
}

export async function extractUnspentProofsForMint(mint: string, tokens: NDKCashuToken[]) {
    const allProofs = tokens.map((t) => t.proofs).flat();
    const _wallet = new CashuWallet(new CashuMint(mint));

    const spentProofs = await _wallet.checkProofsSpent(allProofs);
    const unspentProofs = getUniqueProofs(allProofs, spentProofs);

    return unspentProofs;
}

export function getUniqueProofs(array1: Proof[], array2: Proof[]): Proof[] {
    // Create a Set of JSON stringified objects from array2 for faster lookup
    const array2Set = new Set(array2.map((proof) => JSON.stringify(proof)));

    // Filter array1 to only include objects not in array2
    return array1.filter((proof) => !array2Set.has(JSON.stringify(proof)));
}

export async function cleanWallet(cashuWallet: NDKCashuWallet) {
    const $ndk = get(ndk)
    const $currentUser = get(currentUser)

    const tokensToDestroy: NDKCashuToken[] = [];
    const proofsToSave = new Map<string, Proof[]>();

    // get all the unique mints from tokens
    const mints = new Set<string>();
    cashuWallet.tokens.forEach((t) => {
        if (t.mint) mints.add(t.mint);
    });

    const mintsArray = Array.from(mints);

    const promises = mintsArray.map(async (mint) => {
        const allTokens = cashuWallet!.tokens.filter((t) => t.mint === mint);
        const allProofs = allTokens.map((t) => t.proofs).flat();

        const _wallet = new CashuWallet(new CashuMint(mint));
        const spentProofs = await _wallet.checkProofsSpent(allProofs);

        allTokens.forEach((token) => {
            const unspentProofs = getUniqueProofs(token.proofs, spentProofs);

            // If unspentProofs length is not equal to token.proofs length
            // then it means this token contains some spent proofs.
            // Therefore, we'll add this token to tokensToDestroy array
            // and will add unspent proofs to proofsToSave map
            if (unspentProofs.length !== token.proofs.length) {
                tokensToDestroy.push(token);
                const proofs = proofsToSave.get(mint);
                if (proofs) {
                    proofsToSave.set(mint, [...proofs, ...unspentProofs]);
                } else {
                    proofsToSave.set(mint, unspentProofs);
                }
            }
        });
    });

    await Promise.all(promises);

    const relaySet = cashuWallet.relaySet;


    if (tokensToDestroy.length > 0) {
        const deleteEvent = new NDKEvent($ndk);
        deleteEvent.kind = NDKKind.EventDeletion;
        deleteEvent.tags = [['k', NDKKind.CashuToken.toString()]];

        tokensToDestroy.forEach((token) => {
            deleteEvent.tag(['e', token.id]);
            if (token.relay) relaySet?.addRelay(token.relay);
        });
        await deleteEvent.publish(relaySet);
        cashuWallet.addUsedTokens(tokensToDestroy);
    }

    // handle proofs to save
    const proofsToSaveArray = Array.from(proofsToSave.entries());
    const newTokenPromises = proofsToSaveArray.map(async ([mint, proofs]) => {
        if (proofs.length > 0) {
            // Creating new cashu token for backing up unsaved proofs related to a specific mint
            const newCashuToken = new NDKCashuToken($ndk);
            newCashuToken.proofs = proofs;
            newCashuToken.mint = mint;
            newCashuToken.wallet = cashuWallet!;
            newCashuToken.created_at = Math.floor(Date.now() / 1000);
            newCashuToken.pubkey = $currentUser!.pubkey;

            console.log('Encrypting proofs added to token event');
            newCashuToken.content = JSON.stringify({
                proofs: newCashuToken.proofs,
            });

            // encrypt the new token event
            await newCashuToken.encrypt($currentUser!, undefined, 'nip44');
            await newCashuToken.publish();
            cashuWallet?.emit('token_created', newCashuToken);
        }
    });

    await Promise.all(newTokenPromises);
}

export async function backupWallet(cashuWallet: NDKCashuWallet) {
    const $ndk = get(ndk);
    const $currentUser = get(currentUser);
    const $cashuTokensBackup = get(cashuTokensBackup);
    const $unsavedProofsBackup = get(unsavedProofsBackup);

    const tokenPromises = cashuWallet.tokens.map((token) => token.toNostrEvent());
    const tokens = await Promise.all(tokenPromises);

    // When user triggers manual backup its possible that
    // there are some tokens in svelte persisted store that are not in wallet
    // include those proofs too
    const tokenIds = tokens.map((t) => t.id);
    $cashuTokensBackup.forEach((value) => {
        if (!tokenIds.includes(value.id)) {
            tokens.push(value);
        }
    });

    // Its also possible that there are some unsaved proofs in svelte persisted store
    // We need to include these proofs in backup too
    const unsavedProofsArray = Array.from($unsavedProofsBackup.entries());
    const unsavedProofsPromises = unsavedProofsArray.map(async ([mint, proofs]) => {
        if (proofs.length > 0) {
            // Creating new cashu token for backing up unsaved proofs related to a specific mint
            const newCashuToken = new NDKCashuToken($ndk);
            newCashuToken.proofs = proofs;
            newCashuToken.mint = mint;
            newCashuToken.wallet = cashuWallet!;
            newCashuToken.created_at = Math.floor(Date.now() / 1000);
            newCashuToken.pubkey = $currentUser!.pubkey;

            console.log('Encrypting proofs added to token event');
            newCashuToken.content = JSON.stringify({
                proofs: newCashuToken.proofs,
            });

            // encrypt the new token event
            await newCashuToken.encrypt($currentUser!, undefined, 'nip44');
            const cashuTokenEvent = await newCashuToken.toNostrEvent();
            tokens.push(cashuTokenEvent);
        }
    });

    await Promise.all(unsavedProofsPromises);

    cashuWallet.event.tags = cashuWallet.publicTags;
    cashuWallet.event.content = JSON.stringify(cashuWallet.privateTags);
    await cashuWallet.event.encrypt($currentUser!, undefined, 'nip44');

    const json = {
        wallet: cashuWallet.event.rawEvent(),
        tokens,
    };

    const stringified = JSON.stringify(json, null, 2);

    saveToFile(stringified);
}

// Function to save encrypted content to a file
function saveToFile(content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Create a link element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wallet-backup.json';
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
}