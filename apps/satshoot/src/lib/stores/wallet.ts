import { getCashuPaymentInfo } from '$lib/utils/helpers';
import { NDKUser, type CashuPaymentInfo, type NostrEvent } from '@nostr-dev-kit/ndk';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import NDKWalletService, {
    NDKCashuToken,
    NDKCashuWallet,
    NutzapMonitor,
} from '@nostr-dev-kit/ndk-wallet';
import { derived, get, writable, type Readable } from 'svelte/store';
import { myTickets } from './freelance-eventstores';
import currentUser from './user';
import { getMapSerializer, SatShootPubkey } from '$lib/utils/misc';
import type { Proof } from '@cashu/cashu-ts';
import { persisted } from 'svelte-persisted-store';
import ndk from './ndk';

export const wallet = writable<NDKCashuWallet | null>(null);
export const ndkNutzapMonitor = writable<NutzapMonitor | null>(null);

export const unsavedProofsBackup = persisted('unsavedProofsBackup', new Map<string, Proof[]>(), {
    storage: 'local',
    serializer: getMapSerializer(),
});

export const cashuTokensBackup = persisted('cashuTokensBackup', new Map<string, NostrEvent>(), {
    storage: 'local',
    serializer: getMapSerializer(),
});

export function walletInit(ndk: NDKSvelte, user: NDKUser) {
    const service = new NDKWalletService(ndk);

    let hasSubscribedForNutZaps = false;

    service.on('wallet:default', (w) => {
        const ndkCashuWallet = w as NDKCashuWallet;
        wallet.set(ndkCashuWallet);
        if (!hasSubscribedForNutZaps) {
            hasSubscribedForNutZaps = true;
            handleRolloverEvents(ndkCashuWallet);
            subscribeForNutZaps(ndk, user, ndkCashuWallet);
        }
    });

    service.start(user);
}

export const subscribeForNutZaps = (ndk: NDKSvelte, user: NDKUser, wallet: NDKCashuWallet) => {
    const nutzapMonitor = new NutzapMonitor(ndk, user, wallet.relaySet);
    nutzapMonitor.addWallet(wallet);
    nutzapMonitor.on('seen', (nutzapEvent) => {
        console.log('nutzapEvent :>> ', nutzapEvent);
    });
    nutzapMonitor.start();
    ndkNutzapMonitor.set(nutzapMonitor);
};

const handleRolloverEvents = (cashuWallet: NDKCashuWallet) => {
    cashuWallet.on(
        'rollover_failed',
        async (
            usedTokens: NDKCashuToken[],
            movedProofs: Proof[],
            changes: Proof[],
            mint: string
        ) => {
            console.log('rollover failed in ndk, backing up tokens at app level');

            usedTokens.forEach((t) => {
                cashuWallet.removeTokenId(t.id);
            });

            let createdToken: NDKCashuToken | undefined;

            const proofsToSave = movedProofs;
            for (const change of changes) {
                proofsToSave.push(change);
            }

            if (proofsToSave.length > 0) {
                console.log('Creating new cashu token for backing up unsaved proofs');
                const $ndk = get(ndk);
                const newCashuToken = new NDKCashuToken($ndk);
                newCashuToken.proofs = proofsToSave;
                newCashuToken.mint = mint;
                newCashuToken.wallet = cashuWallet;

                try {
                    console.log('Encrypting proofs added to token event');
                    newCashuToken.content = JSON.stringify({
                        proofs: newCashuToken.proofs,
                    });

                    const $currentUser = get(currentUser);
                    await newCashuToken.encrypt($currentUser!, undefined, 'nip44');

                    newCashuToken.id = newCashuToken.getEventHash();

                    createdToken = newCashuToken;
                } catch (error) {
                    console.log('An error occurred in encrypting proofs.', error);
                    console.log('Backing up unsaved proofs');

                    unsavedProofsBackup.update((map) => {
                        const proofs = map.get(mint);

                        if (proofs) {
                            const existingProofIds = proofs.map((proof) => proof.id);

                            const newProofs = proofsToSave.filter(
                                (proof) => !existingProofIds.includes(proof.id)
                            );

                            map.set(mint, [...proofs, ...newProofs]);
                        } else {
                            map.set(mint, proofsToSave);
                        }

                        return map;
                    });
                }
            }

            cashuTokensBackup.update((map) => {
                // remove used tokens from backup
                usedTokens.forEach((t) => {
                    map.delete(t.id);
                });

                if (createdToken) map.set(createdToken.id, createdToken.rawEvent());

                return map;
            });
        }
    );

    cashuWallet.on(
        'rollover_done',
        (consumedTokens: NDKCashuToken[], createdToken: NDKCashuToken | undefined) => {
            console.log('Rollover done, backing up tokens');

            cashuTokensBackup.update((map) => {
                // remove consumed tokens from backup
                consumedTokens.forEach((t) => {
                    map.delete(t.id);
                });

                if (createdToken) map.set(createdToken.id, createdToken.rawEvent());

                return map;
            });
        }
    );
};

// Maintain a previous map outside the derived store to persist state across invocations
let previousMap = new Map<string, CashuPaymentInfo>(); // Global to ensure persistence between re-renders

// Derived store that processes items and caches results to avoid redundant async operations
export const cashuPaymentInfoMap: Readable<Map<string, CashuPaymentInfo>> = derived(
    [myTickets, currentUser],
    ([$myTickets, $currentUser], set) => {
        // Async function to update the derived store
        async function update() {
            // Copy the current state of previousMap to start fresh but retain processed data
            const newMap = new Map(previousMap);

            // construct a string array which contains all the user who has won the offer, current logged in user and satshoot
            const users = $myTickets
                .map((myTicket) => myTicket.winnerFreelancer)
                .filter((winner) => winner !== undefined);
            if ($currentUser) {
                users.push($currentUser.pubkey);
            }
            users.push(SatShootPubkey);

            // Create an array of promises for each user to fetch payment info only if not already cached
            const promises = users.map((user) => {
                return new Promise<void>((resolve) => {
                    // Check if the user has already been processed
                    if (newMap.has(user)) {
                        resolve(); // Resolve immediately if the data is already cached
                        return;
                    }

                    // Fetch Cashu payment info asynchronously if not already present
                    getCashuPaymentInfo(user)
                        .then((info) => {
                            if (info) newMap.set(user, info); // Add the fetched info to the Map
                        })
                        .catch((err) => {
                            console.error(
                                `An error occurred in fetching Cashu payment info for ${user}`,
                                err
                            );
                        })
                        .finally(() => resolve()); // Resolve the promise once done
                });
            });

            // Wait for all promises to complete before updating the store
            await Promise.allSettled(promises);

            // Update the store with the newly populated map
            set(newMap);

            // Persist the updated map for future reference
            previousMap = newMap;
        }

        update();
    }
);
