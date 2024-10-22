import { getCashuPaymentInfo } from '$lib/utils/helpers';
import { NDKUser, type CashuPaymentInfo } from '@nostr-dev-kit/ndk';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import NDKWalletService, { NDKCashuWallet, NutzapMonitor } from '@nostr-dev-kit/ndk-wallet';
import { derived, writable, type Readable } from 'svelte/store';
import { myTickets } from './freelance-eventstores';
import currentUser from './user';

export const wallet = writable<NDKCashuWallet | null>(null);
export const ndkNutzapMonitor = writable<NutzapMonitor | null>(null);

export function walletInit(ndk: NDKSvelte, user: NDKUser) {
    const service = new NDKWalletService(ndk);

    let hasSubscribedForNutZaps = false;

    service.on('wallet:default', (w) => {
        const ndkCashuWallet = w as NDKCashuWallet;
        wallet.set(ndkCashuWallet);
        if (!hasSubscribedForNutZaps) {
            hasSubscribedForNutZaps = true;
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

            // construct a string array which contains all the user who has won the offer and current logged in user
            const users = $myTickets
                .map((myTicket) => myTicket.winnerFreelancer)
                .filter((winner) => winner !== undefined);
            if ($currentUser) {
                users.push($currentUser.pubkey);
            }

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
