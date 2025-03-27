import { getCashuPaymentInfo } from '$lib/utils/helpers';
import { NDKCashuMintList, NDKUser, type CashuPaymentInfo } from '@nostr-dev-kit/ndk';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import {
    consolidateMintTokens,
    NDKCashuWallet,
    NDKNutzapMonitor,
    NDKWalletStatus,
    type MintUrl,
} from '@nostr-dev-kit/ndk-wallet';
import { derived, writable, type Readable } from 'svelte/store';
import { myTickets } from '$lib/stores/freelance-eventstores';
import currentUser from '$lib/stores/user';
import { getMapSerializer, SatShootPubkey } from '$lib/utils/misc';
import type { Proof } from '@cashu/cashu-ts';
import { persisted } from 'svelte-persisted-store';
import { get } from 'svelte/store';

export const wallet = writable<NDKCashuWallet | null>(null);
export let ndkNutzapMonitor:NDKNutzapMonitor | null = null;

export const walletStatus = writable<NDKWalletStatus>(NDKWalletStatus.INITIAL);

// Used for backing up ALL Proofs of ALL Mints in the wallet, using NDKCashuWallet internal state
// The backup writes a map into local storage, and state consolidation(internal and external)
// is carried out on each wallet initialization (runs after import, session restart etc)
// Does NOT need any async calls before saving state (No signing of an event etc)
export const walletBackup = persisted('walletBackup', new Map<MintUrl, Proof[]>(), {
    storage: 'local',
    serializer: getMapSerializer<MintUrl, Proof[]>(),
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
        walletStatus.set(NDKWalletStatus.READY);

        console.log(
            'Start collecting Cashu info of Freelancers',
            get(cashuPaymentInfoMap)
        );

        customSubscribeForNutZaps(ndk, user, nostrWallet, mintList);

        // If we already have a backup in local storage, try to 
        // load Proofs and sync up in the background
        const $walletBackup = get(walletBackup);
        if ($walletBackup) {
            for (const [mint, proofs] of $walletBackup.entries()) {
                consolidateMintTokens(mint, nostrWallet, proofs);
            }
        }
    });

    nostrWallet.on("balance_updated", () => {
        const $wallet = get(wallet); 
        if ($wallet) {
            // Save entire wallet state on the following operations:
            // Deposit, Create token in own/other mint, Melting
            // This saves immediately after inner wallet state changed
            // Nutzaps however are NOT saved (only after redemption)
            walletBackup.set($wallet.state.getMintsProofs());
        }
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
    },
    // Initial value
    previousMap
);
