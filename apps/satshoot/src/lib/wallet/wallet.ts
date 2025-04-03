import { getCashuPaymentInfo } from '$lib/utils/helpers';
import { NDKCashuMintList, NDKUser, type CashuPaymentInfo } from '@nostr-dev-kit/ndk';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import {
    NDKCashuWallet,
    NDKNutzapMonitor,
    NDKWalletStatus,
} from '@nostr-dev-kit/ndk-wallet';
import { derived, writable, type Readable } from 'svelte/store';
import { myTickets } from '$lib/stores/freelance-eventstores';
import { SatShootPubkey } from '$lib/utils/misc';
import { persisted } from 'svelte-persisted-store';
import { get } from 'svelte/store';
import {
    parseAndValidateBackup,
    recoverWallet,
    serializeWallet,
    toWalletStorage,
    type WalletStorage 
} from './cashu';

export const wallet = writable<NDKCashuWallet | null>(null);
export let userCashuInfo = writable<NDKCashuMintList | null>(null);
export let ndkNutzapMonitor:NDKNutzapMonitor | null = null;

export const walletStatus = writable<NDKWalletStatus>(NDKWalletStatus.INITIAL);

// Used for backing up ALL Proofs of ALL Mints and p2pk-s in the wallet,
// using NDKCashuWallet internal state
// The backup writes to local storage, and state consolidation(internal and external)
// is carried out on each wallet initialization (runs after import, session restart etc)
// Does NOT need any async calls before saving state (No signing of an event etc)
export const walletBackup = persisted<WalletStorage | null>(
    'walletBackup',
    null,
    {
        storage: 'local',
        serializer: {
            stringify(walletStorage: WalletStorage) {
                return serializeWallet(walletStorage)
            },
            parse(text) {
                return parseAndValidateBackup(text)
            },
        },
    }
);

export async function walletInit(
    nostrWallet: NDKCashuWallet,
    mintList:NDKCashuMintList,
    ndk: NDKSvelte,
    user: NDKUser,
) {
    if (!nostrWallet._p2pk) {
        await nostrWallet.getP2pk();
    }

    wallet.set(nostrWallet);
    userCashuInfo.set(mintList)

    nostrWallet.on("ready", async () => {
        walletStatus.set(NDKWalletStatus.READY);

        console.log(
            'Start collecting Cashu info of Freelancers',
            get(cashuPaymentInfoMap)
        );

        ndkNutzapMonitor = new NDKNutzapMonitor(ndk, user, {mintList});
        ndkNutzapMonitor.wallet = nostrWallet;

        ndkNutzapMonitor.on('seen', (nutzapEvent) => {
            console.log('nutzapEvent :>> ', nutzapEvent);
        });

        // If we already have a backup in local storage, try to 
        // load Proofs, sync up and add p2pk privkeys to nutzapMonitor
        const $walletBackup = get(walletBackup);
        if ($walletBackup) {
            await recoverWallet($walletBackup, nostrWallet, ndkNutzapMonitor)
        }

        ndkNutzapMonitor.start({
            filter: { limit: 100 },
            opts: { skipVerification: true },
        });
    });

    nostrWallet.on("balance_updated", () => {
        const $wallet = get(wallet); 
        if ($wallet) {
            console.info('Balance updated, saving backup...', $wallet.balance);
            // Save entire wallet state on the following operations:
            // Deposit, Create token in own/other mint, Melting
            // This saves immediately after inner wallet state changed
            // Nutzaps however are NOT saved (only after redemption)
            walletBackup.set(toWalletStorage($wallet));
        }
    });

    nostrWallet.start({subId: 'wallet', pubkey: user.pubkey});
}

// Maintain a previous map outside the derived store to persist state across invocations
let previousMap = new Map<string, CashuPaymentInfo>(); // Global to ensure persistence between re-renders

// Derived store that processes items and caches results to avoid redundant async operations
export const cashuPaymentInfoMap: Readable<Map<string, CashuPaymentInfo>> = derived(
    [myTickets],
    ([$myTickets], set) => {
        // Async function to update the derived store
        async function update() {
            // Copy the current state of previousMap to start fresh but retain processed data
            const newMap = new Map(previousMap);

            // construct a string array which contains all the user who has won the offer, current logged in user and satshoot
            const users = $myTickets
                .map((myTicket) => myTicket.winnerFreelancer)
                .filter((winner) => winner !== undefined);

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
