import { getCashuPaymentInfo } from '$lib/utils/helpers';
import { NDKCashuMintList, NDKUser, type CashuPaymentInfo, type NostrEvent } from '@nostr-dev-kit/ndk';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import {
    NDKCashuWallet,
    NDKNutzapMonitor,
    NDKWalletStatus,
} from '@nostr-dev-kit/ndk-wallet';
import { derived, writable, type Readable } from 'svelte/store';
import { myTickets } from './freelance-eventstores';
import currentUser from './user';
import { getMapSerializer, SatShootPubkey } from '$lib/utils/misc';
import type { Proof } from '@cashu/cashu-ts';
import { persisted } from 'svelte-persisted-store';

export const wallet = writable<NDKCashuWallet | null>(null);
export let ndkNutzapMonitor:NDKNutzapMonitor | null = null;

export const walletStatus = writable<NDKWalletStatus>(NDKWalletStatus.INITIAL);

export const unsavedProofsBackup = persisted('unsavedProofsBackup', new Map<string, Proof[]>(), {
    storage: 'local',
    serializer: getMapSerializer<string, Proof[]>(),
});

export const cashuTokensBackup = persisted('cashuTokensBackup', new Map<string, NostrEvent>(), {
    storage: 'local',
    serializer: getMapSerializer<string, NostrEvent>(),
});

export function walletInit(
    nostrWallet: NDKCashuWallet,
    mintList:NDKCashuMintList,
    ndk: NDKSvelte,
    user: NDKUser,
    customSubscribeForNutZaps = subscribeForNutZaps // Allow injection for testing
) {
    let hasSubscribedForNutZaps = false;
    wallet.set(nostrWallet);

    nostrWallet.on("ready", () => {
        hasSubscribedForNutZaps = true;
        // walletStatus.set(WalletStatus.Loaded);

        customSubscribeForNutZaps(ndk, user, nostrWallet, mintList);
    });

    nostrWallet.start({subId: 'wallet', pubkey: user.pubkey});
}

export const subscribeForNutZaps = (
    ndk: NDKSvelte,
    user: NDKUser,
    wallet: NDKCashuWallet,
    mintList: NDKCashuMintList
) => {
    ndkNutzapMonitor = new NDKNutzapMonitor(ndk, user, {mintList});
    ndkNutzapMonitor.wallet = wallet;
    ndkNutzapMonitor.on('seen', (nutzapEvent) => {
        console.log('nutzapEvent :>> ', nutzapEvent);
    });
    ndkNutzapMonitor.start({
        filter: { limit: 100 },
        opts: { skipVerification: true },
    });
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
