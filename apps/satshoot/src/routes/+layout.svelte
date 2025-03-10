<script lang="ts">
    import '../app.css';

    // Font awesome
    import '@fortawesome/fontawesome-free/css/brands.css';
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
    import '@fortawesome/fontawesome-free/css/solid.css';

    import ndk, { bunkerNDK, sessionPK } from '$lib/stores/ndk';
    import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

    import { Dexie } from 'dexie';

    import { online, retryConnection } from '$lib/stores/network';
    import currentUser, { loggedIn, loggingIn, loginMethod, mounted } from '$lib/stores/user';

    import {
        allOffers,
        allTickets,
        myOffers,
        myTickets,
        wotFilteredOffers,
        wotFilteredTickets,
    } from '$lib/stores/freelance-eventstores';

    import { messageStore, wotFilteredMessageFeed } from '$lib/stores/messages';
    import { sendNotification } from '$lib/stores/notifications';
    import { allReviews, clientReviews, freelancerReviews } from '$lib/stores/reviews';
    import { allReceivedZaps, filteredReceivedZaps } from '$lib/stores/zaps';

    import { checkRelayConnections, initializeUser, logout } from '$lib/utils/helpers';

    import { wotUpdateFailed, wotUpdateNoResults } from '$lib/stores/wot';

    import { LoginMethod, RestoreMethod } from '$lib/stores/ndk';

    import {
        NDKKind,
        NDKNip07Signer,
        NDKNip46Signer,
        NDKPrivateKeySigner,
        NDKSubscription,
        type NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import { privateKeyFromSeedWords } from 'nostr-tools/nip06';

    import { privateKeyFromNsec } from '$lib/utils/nip19';

    import { page, updated } from '$app/stores';
    import { AppShell, getDrawerStore, getModeAutoPrefers } from '@skeletonlabs/skeleton';
    // Popups
    import { arrow, autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

    import { storePopup, type PopupSettings } from '@skeletonlabs/skeleton';

    // Menu Items

    import { modeCurrent, setModeCurrent } from '@skeletonlabs/skeleton';
    // Skeleton Toast
    import { Toast, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';

    // Skeleton Modals
    import DecryptSecretModal from '$lib/components/Modals/DecryptSecretModal.svelte';
    import {
        Drawer,
        type DrawerSettings,
        type ModalComponent,
        type ModalSettings,
    } from '@skeletonlabs/skeleton';
    import { Modal, getModalStore } from '@skeletonlabs/skeleton';
    // Skeleton stores init
    import { beforeNavigate } from '$app/navigation';
    import Footer from '$lib/components/layout/Footer.svelte';
    import Header from '$lib/components/layout/Header.svelte';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import type { TicketEvent } from '$lib/events/TicketEvent';

    import { searchTerms } from '$lib/stores/search';
    import {
        cashuPaymentInfoMap,
        cashuTokensBackup,
        unsavedProofsBackup,
        wallet,
    } from '$lib/stores/wallet';
    import { cleanWallet, isCashuMintListSynced, resyncWalletAndBackup } from '$lib/utils/cashu';
    import { debounce } from '$lib/utils/misc';
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { onDestroy, onMount, tick } from 'svelte';
    import SidebarLeft from '$lib/components/layout/SidebarLeft.svelte';
    import drawerID, { DrawerIDs } from '$lib/stores/drawer';
    import AppMenu from '$lib/components/layout/AppMenu.svelte';

    initializeStores();

    // Skeleton popup init
    storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

    beforeNavigate(async ({ to }) => {
        if (to?.url.pathname !== '/jobs') {
            // clear search terms by initializing a new set
            searchTerms.set(new Set());
        }
    });

    $: searchQuery = $page.url.searchParams.get('searchTerms');
    $: filterList = searchQuery ? searchQuery.split(',') : [];

    // on page reload if url contains searchTerms add them to svelte store
    $: if (filterList.length > 0) {
        searchTerms.set(new Set(filterList));
    }

    // For WoT tooltip
    const popupWoT: PopupSettings = {
        event: 'click',
        target: 'popupWoT',
        placement: 'right',
    };

    const toastStore = getToastStore();
    const modalStore = getModalStore();
    const drawerStore = getDrawerStore();

    $: displayNav = $loggedIn;

    let followSubscription: NDKSubscription | undefined = undefined;

    $: if ($retryConnection === 0) {
        const t: ToastSettings = {
            message: 'Could not reconnect to Relays!',
            autohide: false,
            action: {
                label: 'Reload page',
                response: () => {
                    window.location.reload();
                },
            },
            classes: 'flex flex-col items-center gap-y-2 text-lg font-bold',
        };
        toastStore.trigger(t);
    }

    $: if ($wotUpdateFailed) {
        const t: ToastSettings = {
            message: 'Could not load Web of Trust!',
            autohide: false,
            action: {
                label: 'Retry',
                response: () => {
                    window.location.reload();
                },
            },
            classes: 'flex flex-col items-center gap-y-2 text-lg font-bold',
        };
        toastStore.trigger(t);
    }

    $: if ($wotUpdateNoResults) {
        const t: ToastSettings = {
            message: 'Could not load Your Web of Trust!',
            autohide: false,
            action: {
                label: 'Retry',
                response: () => {
                    window.location.reload();
                },
            },
            classes: 'flex flex-col items-center gap-y-2 text-lg font-bold',
        };
        toastStore.trigger(t);
    }

    // Use the debounced function with resyncWalletAndBackup, setting a delay of 10 seconds
    const debouncedResync = debounce(resyncWalletAndBackup, 10000);

    $: if ($wallet && $cashuTokensBackup && $unsavedProofsBackup) {
        debouncedResync($wallet, $cashuTokensBackup, $unsavedProofsBackup);
    }

    async function restoreLogin() {
        // For UI feedback
        $loggingIn = true;
        await tick();

        // Migration to login-method = 'local'  instead of 'ephemeral'
        let method = localStorage.getItem('login-method');
        if (method === 'ephemeral') {
            localStorage.setItem('login-method', 'local');
            method = 'local';
        }

        // Try to get saved Login method from localStorage and login that way
        $loginMethod = (method as LoginMethod) ?? null;

        if ($loginMethod) {
            if ($loginMethod === LoginMethod.Local) {
                // We either get the private key from sessionStorage or decrypt from localStorage
                if ($sessionPK) {
                    $ndk.signer = new NDKPrivateKeySigner($sessionPK);
                } else {
                    try {
                        // Get decrypted seed from a modal prompt where user enters passphrase
                        // User can dismiss modal in which case decryptedSeed is undefined
                        const responseObject: any = await new Promise<string | undefined>(
                            (resolve) => {
                                const modalComponent: ModalComponent = {
                                    ref: DecryptSecretModal,
                                };

                                const modal: ModalSettings = {
                                    type: 'component',
                                    component: modalComponent,
                                    response: (responseObject: any) => {
                                        resolve(responseObject);
                                    },
                                };
                                // Call DecryptSecret Modal to prompt for passphrase
                                // This can throw invalid secret if decryption was unsuccessful
                                modalStore.trigger(modal);
                                // We got some kind of response from modal
                            }
                        );

                        if (responseObject) {
                            const decryptedSecret = responseObject['decryptedSecret'];
                            const restoreMethod = responseObject['restoreMethod'];
                            if (decryptedSecret && restoreMethod) {
                                let privateKey: string | undefined = undefined;
                                if (restoreMethod === RestoreMethod.Seed) {
                                    privateKey = privateKeyFromSeedWords(decryptedSecret);
                                } else if (restoreMethod === RestoreMethod.Nsec) {
                                    privateKey = privateKeyFromNsec(decryptedSecret);
                                }

                                if (privateKey) {
                                    $ndk.signer = new NDKPrivateKeySigner(privateKey);
                                    $sessionPK = privateKey;
                                } else {
                                    throw new Error(
                                        'Could not create hex private key from decrypted secret. \
                                        Clear browser local storage and login again.'
                                    );
                                }
                            } else {
                                $loggingIn = false;
                                return;
                            }
                        } else {
                            $loggingIn = false;
                            return;
                        }
                    } catch (e) {
                        const t: ToastSettings = {
                            message: `Could not create private key from local secret, error: ${e}`,
                            autohide: false,
                        };
                        toastStore.trigger(t);
                    }
                }
            } else if ($loginMethod === LoginMethod.Bunker) {
                const localBunkerKey = localStorage.getItem('bunkerLocalSignerPK');
                const bunkerTargetNpub = localStorage.getItem('bunkerTargetNpub');
                const bunkerRelayURLsString = localStorage.getItem('bunkerRelayURLs');

                if (localBunkerKey && bunkerTargetNpub && bunkerRelayURLsString) {
                    const bunkerRelayURLs = bunkerRelayURLsString.split(',');
                    bunkerRelayURLs.forEach((url: string) => {
                        // ONLY WORKS WITH EXPLICIT RELAYS, NOT WITH SIMPLE POOL.ADDRELAY() CALL
                        $bunkerNDK.addExplicitRelay(url);
                    });

                    await $bunkerNDK.connect();
                    console.log(
                        'ndk connected to specified bunker relays',
                        $bunkerNDK.pool.connectedRelays()
                    );

                    let connectionParams = bunkerTargetNpub;

                    const localSigner = new NDKPrivateKeySigner(localBunkerKey);
                    const remoteSigner = new NDKNip46Signer(
                        $bunkerNDK,
                        connectionParams,
                        localSigner
                    );

                    setTimeout(() => {
                        if (!$ndk.signer) {
                            const t: ToastSettings = {
                                autohide: false,
                                message:
                                    '\
                                    <p class="text-center">Bunker connection took too long!</p>\
                                    <p>Fix or Remove Bunker Connection!</p>\
                                    ',
                                action: {
                                    label: 'Delete Bunker Connection',
                                    response: () => {
                                        logout();
                                    },
                                },
                                classes: 'flex flex-col items-center gap-y-2 text-lg font-bold',
                                background: 'bg-warning-300-600-token',
                            };
                            toastStore.trigger(t);

                            $loggingIn = false;
                            tick();
                        }
                    }, 20000);
                    try {
                        const returnedUser = await remoteSigner.blockUntilReady();
                        if (returnedUser.npub) {
                            $ndk.signer = remoteSigner;
                        }
                    } catch (e) {
                        const t: ToastSettings = {
                            message: `
                        <p>Could not connect to Bunker!</p>
                        <p>
                        <span> Reason: </span>
                        <span> ${e} </span>
                        </p>
`,
                            autohide: false,
                            background: 'bg-error-300-600-token',
                            classes: 'font-bold',
                        };
                        toastStore.trigger(t);
                        $loggingIn = false;
                        return;
                    }
                }
            } else if ($loginMethod === LoginMethod.Nip07) {
                if (!$ndk.signer) {
                    $ndk.signer = new NDKNip07Signer();
                }
            }
        }
        // If signer is defined we can init user
        if ($ndk.signer) {
            initializeUser($ndk, toastStore);
        }

        console.log('setting loggingIn to false');
        $loggingIn = false;
    }

    function configureBasics() {
        localStorage.debug = '*';
        if (!$modeCurrent) {
            setModeCurrent(getModeAutoPrefers());
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            showAppInstallPromotion = true;
        });

        window.addEventListener('offline', () => {
            console.log('offline');
            const t: ToastSettings = {
                message: 'Offline',
                autohide: false,
                background: 'bg-warning-300-600-token',
            };
            toastStore.trigger(t);
            $online = false;
        });

        window.addEventListener('online', () => {
            $online = true;

            window.location.reload();
        });

        // We need to check relay connections on regaining focus,
        // especially on mobile where user can put app in the background
        window.addEventListener('focus', () => {
            checkRelayConnections();
        });

        window.onunhandledrejection = async (event: PromiseRejectionEvent) => {
            event.preventDefault();
            console.log(event.reason);
            if (event.reason?.name === Dexie.errnames.DatabaseClosed) {
                console.log(
                    'Could not open Dexie DB, probably version change. Deleting old DB and reloading...'
                );
                await Dexie.delete('satshoot-db');
                // Must reload to open a brand new DB
                window.location.reload();
            }
        };
    }

    onMount(async () => {
        console.log('onMount layout');

        $mounted = true;
        // Setup client-side caching
        if (!$ndk.cacheAdapter) {
            $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });
        }

        configureBasics();

        await $ndk.connect();

        if (!$loggedIn) {
            restoreLogin();
        }
    });

    onDestroy(() => {
        console.log('layout on destroy');

        if (followSubscription) followSubscription.stop();

        if (allTickets) allTickets.empty();
        if (allOffers) allOffers.empty();
        if (myTickets) myTickets.empty();
        if (myOffers) myOffers.empty();

        if (messageStore) messageStore.empty();
        if (allReceivedZaps) allReceivedZaps.empty();
        if (allReviews) allReviews.empty();

        debouncedResync.clear();
    });

    // Check for app updates and offer reload option to user in a Toast
    $: if ($updated) {
        let toastId: string;
        const t: ToastSettings = {
            message: 'New version of the app is available!',
            autohide: false,
            action: {
                label: 'Reload',
                response: () => {
                    // Reload new page circumventing browser cache
                    location.href = location.pathname + '?v=' + new Date().getTime();
                },
            },
            classes: 'flex flex-col items-center gap-y-2 text-lg font-bold',
        };
        toastId = toastStore.trigger(t);
    }

    // Install App promotion
    let deferredInstallPrompt: BeforeInstallPromptEvent;
    let showAppInstallPromotion = false;
    $: if (showAppInstallPromotion) {
        showAppInstallPromotion = false;
        let toastId: string;
        const t: ToastSettings = {
            message: 'Install app for a better experience!',
            autohide: false,
            action: {
                label: 'Install',
                response: async () => {
                    toastStore.close(toastId);
                    deferredInstallPrompt.prompt();
                    // Find out whether the user confirmed the installation or not
                    const { outcome } = await deferredInstallPrompt.userChoice;
                    // The deferredInstallPrompt can only be used once.
                    deferredInstallPrompt = null;
                    // Act on the user's choice
                    if (outcome === 'accepted') {
                        console.log('User accepted the install prompt.');
                    } else if (outcome === 'dismissed') {
                        console.log('User dismissed the install prompt');
                    }
                },
            },
        };
        toastId = toastStore.trigger(t);
    }

    // ----- Notifications ------ //
    $: if ($wotFilteredTickets && $myOffers) {
        // console.log('all tickets change:', $wotFilteredTickets)
        $wotFilteredTickets.forEach((t: TicketEvent) => {
            $myOffers.forEach((o: OfferEvent) => {
                if (o.referencedTicketDTag === t.dTag) {
                    // If users offer won send that else just send relevant ticket
                    if (t.acceptedOfferAddress === o.offerAddress) {
                        sendNotification(o);
                    } else {
                        sendNotification(t);
                    }
                }
            });
        });
    }

    $: if ($wotFilteredOffers && $myTickets) {
        // console.log('all offers change:', $wotFilteredOffers)
        $wotFilteredOffers.forEach((o: OfferEvent) => {
            $myTickets.forEach((t: TicketEvent) => {
                if (o.referencedTicketDTag === t.dTag) {
                    sendNotification(o);
                }
            });
        });
    }

    $: if ($wotFilteredMessageFeed && $currentUser) {
        $wotFilteredMessageFeed.forEach((dm: NDKEvent) => {
            // This is somewhat wasteful: If there was a nice way to attach
            // a callback on uniquely new events in NDKEventStore-s
            // We would not have to iterate over the whole array
            if (dm.pubkey !== $currentUser.pubkey) {
                sendNotification(dm);
            }
        });
    }

    $: if ($clientReviews) {
        $clientReviews.forEach((r: ReviewEvent) => {
            $myTickets.forEach((t: TicketEvent) => {
                if (t.ticketAddress === r.reviewedEventAddress) {
                    sendNotification(r);
                }
            });
        });
    }

    $: if ($freelancerReviews) {
        $freelancerReviews.forEach((r: ReviewEvent) => {
            $myOffers.forEach((o: OfferEvent) => {
                if (o.offerAddress === r.reviewedEventAddress) {
                    sendNotification(r);
                }
            });
        });
    }

    $: if ($filteredReceivedZaps && $currentUser) {
        $filteredReceivedZaps.forEach((zap: NDKEvent) => {
            sendNotification(zap);
        });
    }

    $: if ($currentUser) {
        if (!followSubscription) {
            followSubscription = $ndk.subscribe(
                {
                    kinds: [NDKKind.KindScopedFollow],
                    '#k': [NDKKind.FreelanceTicket.toString(), NDKKind.FreelanceOffer.toString()],
                    '#p': [$currentUser.pubkey],
                },
                {
                    closeOnEose: false,
                }
            );

            followSubscription.on('event', (event) => {
                sendNotification(event);
            });
        }
    }

    $: if ($currentUser && $wallet) {
        // The Cashu wallet may have just been created,
        // and the Cashu mint list event might still be in progress.
        // To allow for this delay, call isCashuMintListSynced
        // within a setTimeout to provide a margin.
        setTimeout(() => {
            isCashuMintListSynced($wallet, $currentUser, toastStore);
        }, 15 * 1000);

        $wallet.on('found_spent_token', () => {
            toastStore.trigger({
                message: `Cashu Wallet contains some tokens which have been spent. Do you want to clean the wallet?`,
                background: 'bg-warning-300-600-token',
                autohide: false,
                action: {
                    label: 'Clean Wallet',
                    response: () => {
                        cleanWallet($wallet)
                            .then((cleanedAmount) => {
                                toastStore.trigger({
                                    message: `${cleanedAmount} spent/duplicate sats cleaned from wallet`,
                                    autohide: false,
                                    background: `bg-success-300-600-token`,
                                });
                            })
                            .catch((err) => {
                                console.trace(err);
                                toastStore.trigger({
                                    message: `Failed to clean wallet!`,
                                    autohide: false,
                                    background: `bg-error-300-600-token`,
                                });
                            });
                    },
                },
            });
        });
    }

    /**
     * When a derived store like cashuPaymentInfoMap is not referenced or used directly in a component, 
     * Svelte might not trigger the store’s subscription, leading to unexpected behaviors like the store 
     * appearing as undefined in modal components.

     * Therefore, we are just referencing cashuPaymentInfoMap to subscribe it and use in payment modal
     */
    console.log('cashuPaymentInfoMap :>> ', $cashuPaymentInfoMap);

    function openAppMenu() {
        $drawerID = DrawerIDs.AppMenu;
        const drawerSettings: DrawerSettings = {
            id: $drawerID.toString(),
            width: 'w-[50vw] sm:w-[40vw] md:w-[30vw]',
            position: 'right',
            bgDrawer: 'bg-surface-300-600-token',
        };
        drawerStore.open(drawerSettings);
    }
</script>

<Toast zIndex="z-[1100]" />
<Modal />
<Drawer regionDrawer={'flex justify-center'} zIndex={'z-50'}>
    {#if $drawerID === DrawerIDs.AppMenu}
        <AppMenu />
    {/if}
</Drawer>
<AppShell slotSidebarLeft="bg-surface-100-800-token">
    <svelte:fragment slot="header">
        <Header on:restoreLogin={restoreLogin} on:openAppMenu={openAppMenu} />
    </svelte:fragment>

    <!-- Router Slot -->
    <slot />

    <svelte:fragment slot="sidebarLeft">
        <SidebarLeft hideSidebarLeft={!displayNav} />
    </svelte:fragment>

    <svelte:fragment slot="footer">
        <Footer hideFooter={!displayNav} />
    </svelte:fragment>
</AppShell>

<!-- <AppHeader /> -->
