import ndk from '$lib/stores/ndk';
import NDK, {
    NDKCashuMintList,
    NDKEvent,
    NDKKind,
    NDKUser,
    type CashuPaymentInfo,
    type NDKFilter,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';
import {
    NDKCashuToken,
    type NDKCashuMintRecommendation,
    type NDKCashuWallet,
} from '@nostr-dev-kit/ndk-wallet';
import type { ToastSettings, ToastStore } from '@skeletonlabs/skeleton';
import { get } from 'svelte/store';
import { getCashuPaymentInfo } from './helpers';
import { isNostrEvent } from './misc';
import { CashuMint, CashuWallet, type Proof } from '@cashu/cashu-ts';
import { cashuTokensBackup, unsavedProofsBackup } from '$lib/stores/wallet';
import currentUser from '$lib/stores/user';
import { encryptSecret } from './crypto';

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

export function findTokensWithDuplicateProofs(tokens: NDKCashuToken[]): NDKCashuToken[] {
    // To track occurrences of proofs
    const proofMap = new Map<string, number>();

    // First pass: Count occurrences of all proofs
    tokens.forEach((token) => {
        token.proofs.forEach((proof) => {
            const proofString = JSON.stringify(proof); // Stringify to compare full object
            proofMap.set(proofString, (proofMap.get(proofString) || 0) + 1);
        });
    });

    // Collect all duplicate proofs
    const duplicateProofs = new Set<string>(
        Array.from(proofMap.entries())
            .filter(([, count]) => count > 1)
            .map(([proofString]) => proofString)
    );

    // Second pass: Filter tokens with duplicate proofs
    return tokens.filter((token) =>
        token.proofs.some((proof) => duplicateProofs.has(JSON.stringify(proof)))
    );
}

export function getUniqueProofs(array1: Proof[], array2: Proof[]): Proof[] {
    // Create a Set of JSON stringified objects from array2 for faster lookup
    const array2Set = new Set(array2.map((proof) => JSON.stringify(proof)));

    // Filter array1 to only include objects not in array2
    return array1.filter((proof) => !array2Set.has(JSON.stringify(proof)));
}

export function removeDuplicateProofs(proofs: Proof[]): Proof[] {
    const seen = new Set<string>();
    return proofs.filter((proof) => {
        // Serialize the proof object
        const proofString = JSON.stringify(proof);
        if (seen.has(proofString)) {
            return false; // Skip duplicates
        }
        seen.add(proofString);
        return true; // Keep unique proofs
    });
}

export async function cleanWallet(cashuWallet: NDKCashuWallet) {
    const $ndk = get(ndk);
    const $currentUser = get(currentUser);

    const tokensToDestroy: NDKCashuToken[] = [];
    const proofsToSave = new Map<string, Proof[]>();

    let prevBalance = 0;
    await cashuWallet.balance().then((res) => {
        if (res) {
            prevBalance = res[0].amount;
        }
    });

    // get all the unique mints from tokens
    const mints = new Set<string>();
    cashuWallet.tokens.forEach((t) => {
        if (t.mint) mints.add(t.mint);
    });

    const mintsArray = Array.from(mints);

    // remove tokens which contains spent proofs
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
                    proofsToSave.set(mint, removeDuplicateProofs([...proofs, ...unspentProofs]));
                } else {
                    proofsToSave.set(mint, removeDuplicateProofs(unspentProofs));
                }
            }
        });
    });

    await Promise.all(promises);

    // Its possible that tokens may have duplicate proofs
    // we need to remove these tokens with duplicate proofs
    // and create a clean token
    const validTokens = cashuWallet.tokens.filter(
        (token) => !tokensToDestroy.some((t) => t.id === token.id)
    );
    const tokensWithDuplicateProofs = findTokensWithDuplicateProofs(validTokens);

    if (tokensWithDuplicateProofs.length > 0) {
        tokensWithDuplicateProofs.forEach((token) => {
            tokensToDestroy.push(token);
            const mint = token.mint || '';

            const proofs = proofsToSave.get(mint);
            if (proofs) {
                proofsToSave.set(mint, removeDuplicateProofs([...proofs, ...token.proofs]));
            } else {
                proofsToSave.set(mint, removeDuplicateProofs([...token.proofs]));
            }
        });
    }

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
        tokensToDestroy.forEach((t) => cashuWallet.removeTokenId(t.id));
        cashuTokensBackup.update((map) => {
            // remove invalid tokens from the backup
            tokensToDestroy.forEach((t) => map.delete(t.id));

            return map;
        });
    }

    // handle proofs to save
    const proofsToSaveArray = Array.from(proofsToSave.entries());
    const newTokenPromises = proofsToSaveArray.map(async ([mint, proofs]) => {
        if (proofs.length > 0) {
            cashuWallet?.emit('received_proofs', proofs, mint);

            // Creating new cashu token for backing up unsaved proofs related to a specific mint
            const newCashuToken = new NDKCashuToken($ndk);
            newCashuToken.proofs = proofs;
            newCashuToken.mint = mint;
            newCashuToken.wallet = cashuWallet!;
            newCashuToken.created_at = Math.floor(Date.now() / 1000);
            newCashuToken.pubkey = $currentUser!.pubkey;
            newCashuToken.content = JSON.stringify({
                proofs: newCashuToken.proofs,
            });

            console.log('Encrypting proofs added to token event');
            await newCashuToken.encrypt($currentUser!, undefined, 'nip44');
            await newCashuToken.publish();

            // When we publish newly created token, It becomes encrypted.
            // To store it in svelte persisted store, we need this in un-encrypted form
            const newToken = await NDKCashuToken.from(newCashuToken);
            if (newToken) {
                cashuWallet.addToken(newToken);
                cashuTokensBackup.update((map) => {
                    // add newToken to backup
                    map.set(newToken.id, newToken.rawEvent());

                    return map;
                });
            }
        }
    });

    await Promise.all(newTokenPromises);

    let newBalance = 0;
    await cashuWallet.balance().then((res) => {
        if (res) {
            newBalance = res[0].amount;
        }
    });

    return prevBalance - newBalance;
}

export async function backupWallet(
    cashuWallet: NDKCashuWallet,
    encrypted?: boolean,
    passphrase?: string
) {
    const $ndk = get(ndk);
    const $currentUser = get(currentUser);
    const $cashuTokensBackup = get(cashuTokensBackup);
    const $unsavedProofsBackup = get(unsavedProofsBackup);

    const tokensToBackup: NostrEvent[] = [];

    const existingTokenIds = cashuWallet.tokens.map((t) => t.id);
    const existingProofs = cashuWallet.tokens.map((t) => t.proofs).flat();

    // When user triggers manual backup its possible that
    // there are some tokens in svelte persisted store that are not in wallet
    // include those proofs too
    $cashuTokensBackup.forEach((token) => {
        const ndkCashuToken = new NDKCashuToken($ndk, token);
        try {
            const content = JSON.parse(ndkCashuToken.content);
            ndkCashuToken.proofs = content.proofs;
            if (!Array.isArray(ndkCashuToken.proofs)) return;

            const proofsCountBeforeFilter = ndkCashuToken.proofs.length;
            const uniqueProofs = getUniqueProofs(ndkCashuToken.proofs, existingProofs);

            // check if token not exists Wallet state and
            // none of the proof is the duplicate of existing proofs in wallet
            if (
                !existingTokenIds.includes(token.id!) &&
                proofsCountBeforeFilter === uniqueProofs.length
            ) {
                tokensToBackup.push(token);
            }
        } catch (e) {}
    });

    cashuWallet.tokens.forEach((token) => {
        tokensToBackup.push(token.rawEvent());
    });

    // Its also possible that there are some unsaved proofs in svelte persisted store
    // We need to include these proofs in backup too
    const unsavedProofsArray = Array.from($unsavedProofsBackup.entries());
    unsavedProofsArray.forEach(([mint, proofs]) => {
        if (proofs.length > 0) {
            // Creating new cashu token for backing up unsaved proofs related to a specific mint
            const newCashuToken = new NDKCashuToken($ndk);
            newCashuToken.proofs = proofs;
            newCashuToken.mint = mint;
            newCashuToken.wallet = cashuWallet!;
            newCashuToken.created_at = Math.floor(Date.now() / 1000);
            newCashuToken.pubkey = $currentUser!.pubkey;
            newCashuToken.content = JSON.stringify({
                proofs: newCashuToken.proofs,
            });
            newCashuToken.id = newCashuToken.getEventHash();

            tokensToBackup.push(newCashuToken.rawEvent());
            // also include token to svelte-persisted-store backup
            cashuTokensBackup.update((map) => {
                map.set(newCashuToken.id, newCashuToken.rawEvent());
                return map;
            });
        }
        // now that we have created a token from these proofs.
        // so  we can remove these proofs from unsaved proofs backup
        unsavedProofsBackup.update((map) => {
            map.delete(mint);

            return map;
        });
    });

    cashuWallet.event.tags = cashuWallet.publicTags;
    cashuWallet.event.content = JSON.stringify(cashuWallet.privateTags);
    await cashuWallet.event.encrypt($currentUser!, undefined, 'nip44');

    const json = {
        wallet: cashuWallet.event.rawEvent(),
        tokens: tokensToBackup,
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

export async function resyncWalletAndBackup(
    $wallet: NDKCashuWallet,
    $cashuTokensBackup: Map<string, NostrEvent>,
    $unsavedProofsBackup: Map<string, Proof[]>
) {
    const $currentUser = get(currentUser);

    console.log('syncing wallet and backup ', $cashuTokensBackup);
    try {
        const $ndk = get(ndk);

        // remove used tokens from wallet
        $wallet.usedTokenIds.forEach((id) => {
            $wallet.removeTokenId(id);
        });

        // get ids of existing tokens in wallet
        const existingTokenIds = $wallet.tokens.map((token) => token.id);
        const existingProofs = $wallet.tokens.map((t) => t.proofs).flat();

        // filter tokens from backup that don't exists in wallet
        const missingTokensInWallet = Array.from($cashuTokensBackup.values()).filter(
            (token) => !existingTokenIds.includes(token.id!)
        );

        if (missingTokensInWallet.length > 0) {
            // convert raw token events to NDKCashuTokens
            const ndkCashuTokens = missingTokensInWallet
                .map((token) => {
                    const ndkCashuToken = new NDKCashuToken($ndk, token);
                    try {
                        const content = JSON.parse(ndkCashuToken.content);
                        ndkCashuToken.proofs = content.proofs;
                        if (!Array.isArray(ndkCashuToken.proofs)) return;
                    } catch (e) {
                        return;
                    }

                    return ndkCashuToken;
                })
                .filter((token) => token instanceof NDKCashuToken);

            const invalidTokens: NDKCashuToken[] = [];

            // get all the unique mints from tokens
            const mints = new Set<string>();
            ndkCashuTokens.forEach((t) => {
                if (t.mint) mints.add(t.mint);
            });

            const mintsArray = Array.from(mints);
            const tokenPromises = mintsArray.map(async (mint) => {
                // get all the proofs tied to tokens with a specific mint
                const allProofs = ndkCashuTokens
                    .filter((t) => t.mint === mint)
                    .map((token) => token.proofs)
                    .flat();

                const _wallet = new CashuWallet(new CashuMint(mint));
                const spentProofs = await _wallet.checkProofsSpent(allProofs);

                ndkCashuTokens
                    .filter((t) => t.mint === mint)
                    .map(async (token) => {
                        // for a token to be valid, it should not have any spent proof
                        // and no proof should be a duplicate of any existing proof in the wallet tokens
                        const proofsCountBeforeFilter = token.proofs.length;

                        // check if there's any proof that has been spent then this is not a valid token
                        const unspentProofs = getUniqueProofs(token.proofs, spentProofs);
                        if (proofsCountBeforeFilter !== unspentProofs.length) {
                            invalidTokens.push(token);
                            return;
                        }

                        // if there's any proof in existing proofs that matches any of the proof
                        // from this token, then its not a valid token
                        const uniqueProofs = getUniqueProofs(token.proofs, existingProofs);
                        if (proofsCountBeforeFilter !== uniqueProofs.length) {
                            invalidTokens.push(token);
                            return;
                        }

                        $wallet.addToken(token);
                        existingProofs.push(...token.proofs);
                    });
            });

            await Promise.all(tokenPromises);

            if (invalidTokens.length > 0) {
                cashuTokensBackup.update((map) => {
                    // remove invalid tokens from the backup
                    invalidTokens.forEach((t) => map.delete(t.id));

                    return map;
                });
            }
        }

        const tokenIdsInBackup = Array.from($cashuTokensBackup.keys());
        const missingTokensInBackup = $wallet.tokens.filter(
            (token) => !tokenIdsInBackup.includes(token.id)
        );

        if (missingTokensInBackup.length > 0) {
            const tokensToBackup: NostrEvent[] = [];
            missingTokensInBackup.map((token) => {
                tokensToBackup.push(token.rawEvent());
            });

            cashuTokensBackup.update((map) => {
                tokensToBackup.forEach((token) => {
                    if (token.id) map.set(token.id, token);
                });

                return map;
            });
        }

        const unsavedProofsArray = Array.from($unsavedProofsBackup.entries());
        unsavedProofsArray.map(async ([mint, proofs]) => {
            if (proofs.length > 0) {
                const _wallet = new CashuWallet(new CashuMint(mint));
                const spentProofs = await _wallet.checkProofsSpent(proofs);
                const unspentProofs = getUniqueProofs(proofs, spentProofs);

                const newProofs = getUniqueProofs(unspentProofs, existingProofs);

                if (newProofs.length > 0) {
                    // Creating new cashu token for backing up unsaved proofs related to a specific mint
                    const newCashuToken = new NDKCashuToken($ndk);
                    newCashuToken.proofs = newProofs;
                    newCashuToken.mint = mint;
                    newCashuToken.wallet = $wallet;
                    newCashuToken.created_at = Math.floor(Date.now() / 1000);
                    newCashuToken.pubkey = $currentUser!.pubkey;
                    newCashuToken.content = JSON.stringify({
                        proofs: newCashuToken.proofs,
                    });
                    newCashuToken.id = newCashuToken.getEventHash();

                    // now that new token has been created
                    // we can add it to wallet and cashuTokensBackup
                    // and remove these proofs from unsaved proofs backup
                    $wallet.addToken(newCashuToken);
                    cashuTokensBackup.update((map) => {
                        map.set(newCashuToken.id, newCashuToken.rawEvent());
                        return map;
                    });
                }
            }
            unsavedProofsBackup.update((map) => {
                map.delete(mint);

                return map;
            });
        });
    } catch (error) {
        console.error('An error occurred in syncing wallet and backup', error);
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
