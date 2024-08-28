<script lang="ts">
    import "../app.css";

    // Font awesome
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
	import '@fortawesome/fontawesome-free/css/solid.css';
	import '@fortawesome/fontawesome-free/css/brands.css';

    import ndk from "$lib/stores/ndk";
    import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
    import { bunkerNDK } from '$lib/stores/ndk';
    import { connected } from "$lib/stores/ndk";
    import {
        sessionPK,
    } from "$lib/stores/ndk";

    import { Dexie } from "dexie";

    import { mounted, loggedIn, userRelaysUpdated } from "$lib/stores/user";
    import currentUser, {loggingIn, loginMethod} from "$lib/stores/user";
    import { online, retryConnection, retryAttempts } from '$lib/stores/network';

    import { 
        wotFilteredTickets,
        wotFilteredOffers,
        myTickets,
        myOffers,
        allOffers,
        allTickets,
    } from "$lib/stores/troubleshoot-eventstores";

    import { 
        allReviews,
        clientReviews,
        troubleshooterReviews,
    } from "$lib/stores/reviews";
    import { messageStore, wotFilteredMessageFeed } from "$lib/stores/messages";
    import { allReceivedZaps, wotFilteredReceivedZaps } from '$lib/stores/zaps';
    import { sendNotification } from "$lib/stores/notifications";

    import { initializeUser, logout } from '$lib/utils/helpers';

    import { wot, wotUpdating } from '$lib/stores/wot';

    import { RestoreMethod, LoginMethod } from "$lib/stores/ndk";

    import { privateKeyFromSeedWords} from "nostr-tools/nip06";
    import {
        NDKNip46Signer,
        NDKNip07Signer, 
        NDKPrivateKeySigner, 
        type NDKEvent,
    } from "@nostr-dev-kit/ndk";

    import { privateKeyFromNsec } from "$lib/utils/nip19";

    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';
    import { AppRail, AppRailAnchor } from '@skeletonlabs/skeleton';
    import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
    import { page, updated } from '$app/stores';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

    // Popups
    import {
        computePosition,
        autoUpdate, 
        offset, 
        shift,
        flip,
        arrow 
    } from '@floating-ui/dom';

    import { storePopup, popup, type PopupSettings } from '@skeletonlabs/skeleton';

    // App menu in drawer
    import AppMenu from "$lib/components/DrawerContents/AppMenu.svelte";

    // Menu Items 
    import TroubleshootIcon from "$lib/components/Icons/TroubleshootIcon.svelte";
    import PostTicketIcon from "$lib/components/Icons/PostTicketIcon.svelte";
    import NotificationsIcon from "$lib/components/Icons/NotificationsIcon.svelte";

    import { setModeCurrent, modeCurrent } from '@skeletonlabs/skeleton';

    // Skeleton Toast
    import { Toast, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';

    // Skeleton Modals
    import { Modal, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import DecryptSecretModal from "$lib/components/Modals/DecryptSecretModal.svelte";

    // Skeleton stores init
    import {
        initializeStores,
        Drawer,
        getDrawerStore,
        type DrawerSettings,
    } from '@skeletonlabs/skeleton';
    import drawerID from '$lib/stores/drawer';
    import { DrawerIDs } from '$lib/stores/drawer';
    import { onMount, onDestroy, tick } from "svelte";
    import { goto } from "$app/navigation";
    import ReviewBreakdown from "$lib/components/DrawerContents/ReviewBreakdown.svelte";
    import UserReviewBreakdown from "$lib/components/DrawerContents/UserReviewBreakdown.svelte";
    import type { TicketEvent } from "$lib/events/TicketEvent";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import type { ReviewEvent } from "$lib/events/ReviewEvent";
    import MessagesIcon from "$lib/components/Icons/MessagesIcon.svelte";
    import { browser } from "$app/environment";

    initializeStores();
    const drawerStore = getDrawerStore();

    // Skeleton popup init
    storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

    // For WoT tooltip    
    const popupWoT: PopupSettings = {
        event: 'click',
        target: 'popupWoT',
        placement: 'bottom'
    };
    const trustColor = 'text-tertiary-500';
    const bgTrustColor = 'bg-tertiary-500';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    $ndk.pool.on('relay:disconnect', () => {
        if ($ndk.pool.stats().connected === 0) {
            $connected = false;
            if (browser && $retryConnection > 0) {
                $retryConnection--;
                retryConnection.set($retryConnection);
                window.location.reload();
            }
        }
    });

    async function restoreLogin() {
        // For UI feedback
        $loggingIn = true;
        await tick();

        // Try to get saved Login method from localStorage and login that way
        $loginMethod = localStorage.getItem("login-method")?? null;

        if ($loginMethod){
            if ($loginMethod === LoginMethod.Ephemeral) {
                // We either get the private key from sessionStorage or decrypt from localStorage
                if ($sessionPK) {
                    $ndk.signer = new NDKPrivateKeySigner($sessionPK); 
                } else {
                    try {
                        // Get decrypted seed from a modal prompt where user enters passphrase
                        // User can dismiss modal in which case decryptedSeed is undefined
                        const responseObject: any = await new Promise<string|undefined>((resolve) => {
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
                        });   

                        if (responseObject) {
                            const decryptedSecret = responseObject['decryptedSecret'];
                            const restoreMethod = responseObject['restoreMethod'];
                            if (decryptedSecret && restoreMethod) {
                                let privateKey:string|undefined = undefined;
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
                                        "Could not create hex private key from decrypted secret. \
                                        Clear browser local storage and login again."
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
                    } catch(e) {
                        const t: ToastSettings = {
                            message:`Could not create private key from local secret, error: ${e}`,
                            autohide: false,
                        };
                        toastStore.trigger(t);
                    }
                }
            } else if($loginMethod === LoginMethod.Bunker) {
                const localBunkerKey = localStorage.getItem("bunkerLocalSignerPK");
                const bunkerTargetNpub = localStorage.getItem("bunkerTargetNpub");
                const bunkerRelayURLsString = localStorage.getItem('bunkerRelayURLs');

                if (localBunkerKey && bunkerTargetNpub && bunkerRelayURLsString) {
                    const bunkerRelayURLs = bunkerRelayURLsString.split(',');
                    bunkerRelayURLs.forEach((url: string) => {
                        // ONLY WORKS WITH EXPLICIT RELAYS, NOT WITH SIMPLE POOL.ADDRELAY() CALL
                        $bunkerNDK.addExplicitRelay(url);
                    });

                    await $bunkerNDK.connect();
                    console.log("ndk connected to specified bunker relays", $bunkerNDK.pool.connectedRelays());
                    if ($bunkerNDK.pool.connectedRelays().length === 0) {
                        const t: ToastSettings = {
                            message: 'Could not connect to Bunker!',
                            autohide: false,
                            background: 'bg-warning-300-600-token',
                            classes: 'font-bold',
                        };
                        toastStore.trigger(t);
                        $loggingIn = false;
                        return;
                    }

                    let connectionParams = bunkerTargetNpub;

                    const localSigner = new NDKPrivateKeySigner(localBunkerKey);
                    const remoteSigner = new NDKNip46Signer(
                        $bunkerNDK,
                        connectionParams,
                        localSigner
                    );

                    setTimeout(
                        ()=>{
                            if (!$ndk.signer) {
                                const t: ToastSettings = {
                                    autohide: false,
                                    message: '\
                                    <p class="text-center">Bunker connection took too long!</p>\
                                    <p>Fix or Remove Bunker Connection!</p>\
                                    ',
                                    action: {
                                        label: 'Delete Bunker Connection',
                                        response: () => {
                                            logout()
                                        },
                                    },
                                    classes: 'flex flex-col items-center gap-y-2 text-lg font-bold',
                                    background: 'bg-warning-300-600-token',
                                };
                                toastStore.trigger(t);

                                $loggingIn = false;
                                tick();
                            }
                        },
                        20000,
                    );
                    try {
                        const returnedUser = await remoteSigner.blockUntilReady();
                        if (returnedUser.npub) {
                            $ndk.signer = remoteSigner;
                        }
                    } catch(e) {
                        const t: ToastSettings = {
                        message:`
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
            } else if ($loginMethod === LoginMethod.NIP07) {
                if (!$ndk.signer) {
                    $ndk.signer = new NDKNip07Signer();
                }
            }
        }
        // If signer is defined we can init user
        if ($ndk.signer) {
            initializeUser($ndk);
        }

        console.log('setting loggingIn to false')
        $loggingIn = false;
    }

    onMount(async () => {
        console.log('onMount layout')

// ---------------------------- Basic Init ----------------------------
        $mounted = true;
        localStorage.debug = 'ndk:*'
        if(!$modeCurrent) {
            setModeCurrent(false);
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            showAppInstallPromotion = true;
        });

        window.addEventListener('offline', (e) => {
            console.log('offline')
            toastStore.clear();
            const t: ToastSettings = {
                message: 'Offline',
                autohide: false,
                background: 'bg-warning-300-600-token',
            };
            toastStore.trigger(t);
            $online = false;
        });

        window.addEventListener('online', (e) => {
            $online = true;

            window.location.reload();
        });

        // Setup client-side caching
        if ( !($ndk.cacheAdapter) ) {
            $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });
        }
        window.onunhandledrejection = async(event: PromiseRejectionEvent) => {
            event.preventDefault();
            console.log(event.reason)
            if (event.reason?.name === Dexie.errnames.DatabaseClosed) {
                console.log('Could not open Dexie DB, probably version change. Deleting old DB and reloading...')
                await Dexie.delete('satshoot-db');
                // Must reload to open a brand new DB
                window.location.reload();

            }

        };
        // db.on('versionchange', async() => {
        //     console.log('Dexie DB version changed, deleting old DB...')
        // });

        await $ndk.connect();
        $connected = ($ndk.pool.stats().connected > 0);

        // If we managed to connect reset max connection retry attempts
        if ($connected) {
            $retryConnection = $retryAttempts;
            retryConnection.set($retryAttempts);
        }

// ------------------------ Restore Login -----------------------------------

        if (!$loggedIn) {
            restoreLogin();
        }
    });

    onDestroy(() => {
        console.log('layout on destroy')

        if (allTickets) allTickets.empty();
        if (allOffers) allOffers.empty();
        if (myTickets) myTickets.empty();
        if (myOffers) myOffers.empty();

        if (messageStore) messageStore.empty();
        if (allReceivedZaps) allReceivedZaps.empty();
        if (allReviews) allReviews.empty();
    });

    // Check for app updates and offer reload option to user in a Toast
    $: if ($updated) {
        let toastId:string;
        const t: ToastSettings = {
            message: 'New version of the app is available!',
            autohide: false,
            action: {
                label: 'Reload',
                response: () => {
                    // Reload new page circumventing browser cache
                    location.href = location.pathname + '?v='
                    + new Date().getTime();
                },
            },
            classes: 'flex flex-col items-center gap-y-2 text-lg font-bold'
        };
        toastId = toastStore.trigger(t);
    }

    // Install App promotion
    let deferredInstallPrompt: BeforeInstallPromptEvent;
    let showAppInstallPromotion = false;
    $: if(showAppInstallPromotion) {
        showAppInstallPromotion = false;
        let toastId:string;
        const t: ToastSettings = {
            message: 'Install app for a better experience!',
            autohide: false,
            action: {
                label: 'Install',
                response: async() => {
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
            }
        };
        toastId = toastStore.trigger(t);
    }

    // Relays updated
    $: if ($userRelaysUpdated) {
        const t: ToastSettings = {
            message: 'Did not find Outbox Relays, setting default values...',
            timeout: 8000,
            background: 'bg-warning-300-600-token',
        };
        toastStore.trigger(t);
    }

    // ----- Notifications ------ //
    $: if($wotFilteredTickets && $myOffers) {
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

    $: if ($troubleshooterReviews) {
        $troubleshooterReviews.forEach((r: ReviewEvent) => {
            $myOffers.forEach((o: OfferEvent) => {
                if (o.offerAddress === r.reviewedEventAddress) {
                    sendNotification(r);
                }
            });
        });
    }

    $: if ($wotFilteredReceivedZaps && $currentUser) {
        $wotFilteredReceivedZaps.forEach((zap: NDKEvent) => {
            sendNotification(zap);
        });
    }

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

<Toast />
<Modal />
<Drawer regionDrawer={'flex justify-center'} zIndex={'z-50'}>
    {#if $drawerID === DrawerIDs.AppMenu}
        <AppMenu/>
    {:else if $drawerID === DrawerIDs.ReviewBreakdown}
        <ReviewBreakdown />
    {:else if $drawerID === DrawerIDs.UserReviewBreakdown}
        <UserReviewBreakdown />
    {/if}
</Drawer>
<AppShell slotSidebarLeft="bg-surface-100-800-token">
	<svelte:fragment slot="header">
        <AppBar gridColumns="grid-cols-3" slotDefault="place-content-center" slotTrail="place-content-end ">
            <svelte:fragment slot="lead">
                <div class ='flex gap-x-2 items-center'>
                    <h3 class='h3 font-bold'>WoT:</h3>
                    <div>
                        {#if !$loggedIn}
                            <i 
                                class="fa-solid fa-circle-question text-2xl text-error-500"
                                use:popup={popupWoT}
                            >
                            </i>
                            <div data-popup="popupWoT">
                                <div class="card font-bold w-40 p-4 text-error-500 max-h-60 overflow-y-auto">
                                    Log in to Load your Web of Trust!
                                </div>
                            </div>
                        {:else if $wot && $wot.size < 3 && $wotUpdating}
                            <ProgressRadial
                                value={undefined}
                                stroke={60}
                                meter="stroke-error-500"
                                track="stroke-error-500/30"
                                strokeLinecap="round" width="w-8" 
                            />
                            {:else if $wot && $wot.size > 2 && $wotUpdating}
                            <ProgressRadial
                                value={undefined}
                                stroke={60}
                                meter="stroke-success-500"
                                track="stroke-success-500/30"
                                strokeLinecap="round" width="w-8" 
                            />
                            {:else if $wot && $wot.size > 2}
                            <i 
                                class="fa-solid fa-circle-check text-2xl {trustColor}"
                                use:popup={popupWoT}
                            >
                            </i>
                            <div data-popup="popupWoT">
                                <div class="card font-bold w-40 p-4 {bgTrustColor} max-h-60 overflow-y-auto">
                                    Web of Trust Loaded
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </svelte:fragment>

            <div class="flex justify-center lg:ml-20">
                <div class ='flex gap-x-2 justify-center items-center'>
                    <button class="btn btn-icon w-16" on:click={()=>{goto('/')}}>
                        <img src="/satshoot.svg" alt="logo" />
                    </button>
                    
                </div>
            </div>

            <svelte:fragment slot="trail">
                {#if $loggedIn}
                    <button on:click={openAppMenu}>
                        <!-- Avatar image -->
                        <Avatar 
                            class="rounded-full border-white placeholder-white"
                            border="border-4 border-surface-300-600-token hover:!border-primary-500"
                            cursor="cursor-pointer"
                            src={
                            $currentUser?.profile?.image
                                ?? `https://robohash.org/${$currentUser.pubkey}`
                            }
                        /> 
                    </button>
                {:else if $loggingIn}
                    <div class="flex gap-x-2">
                        <h3 class='h6 md:h3 font-bold'>Logging in...</h3>
                        <ProgressRadial
                            value={undefined}
                            stroke={80}
                            meter="stroke-primary-500"
                            track="stroke-primary-500/30"
                            strokeLinecap="round" width="w-12" 
                        />
                    </div>
                {:else if $loginMethod === LoginMethod.Ephemeral}
                    <button 
                        class="btn bg-primary-300-600-token"
                        type="button"
                        on:click={ restoreLogin }
                    >
                        Login
                    </button>
                {:else}
                    <a href="/login" class="btn btn-md bg-primary-300-600-token ">
                        <span>Login</span>
                    </a>

                {/if}
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
    <!-- Sidebar. Hidden on small screens -->
	<svelte:fragment slot="sidebarLeft">
            <AppRail 
                class="hidden lg:block min-w-28"
                hover="hover:variant-soft-primary"
                active="bg-primary-300-600-token"
                background="bg-surface-100-800-token"
            >
                <svelte:fragment slot="lead">
                    <AppRailAnchor
                        href="/"
                        selected={$page.url.pathname === '/'}
                    >
                        <TroubleshootIcon sizeClass={'text-2xl sm:text-3xl'} />
                    </AppRailAnchor>

                    <AppRailAnchor
                        href="/post-ticket"
                        selected={$page.url.pathname.includes('/post-ticket')}
                    >
                        <PostTicketIcon sizeClass={'text-2xl sm:text-3xl'} />
                    </AppRailAnchor>
                    <AppRailAnchor
                        href="/messages"
                        selected={
                        $page.url.pathname.includes('/messages')
                            && !($page.url.pathname.includes('naddr'))
                        }
                    >
                        <MessagesIcon sizeClass={'text-2xl sm:text-3xl'} />
                    </AppRailAnchor>
                    <AppRailAnchor
                        href="/notifications"
                        selected={$page.url.pathname.includes('/notifications')}
                    >
                        <NotificationsIcon sizeClass={'text-2xl sm:text-3xl'} />
                    </AppRailAnchor>
                </svelte:fragment>
            </AppRail>
    </svelte:fragment>

	<!-- Router Slot -->
	<slot />

    <!-- Footer: Only visible on small and medium screens(sm, md) -->
	<svelte:fragment slot="footer">
        <TabGroup 
            justify="justify-center"
            flex="flex-1"
            rounded=""
            border=""
            hover="hover:variant-soft-primary"
            active="bg-primary-300-600-token"
            background="bg-surface-100-800-token"
            class="lg:hidden w-full"
        >
            <TabAnchor 
                href="/" 
                selected={$page.url.pathname === '/'}
            >
                <TroubleshootIcon sizeClass={'text-2xl sm:text-3xl'} />
            </TabAnchor>

            <TabAnchor 
                href="/post-ticket"
                selected={$page.url.pathname.includes('/post-ticket')}
            >
                <PostTicketIcon sizeClass={'text-2xl sm:text-3xl'} />
            </TabAnchor>
            <TabAnchor 
                href="/messages"
                selected={
                    $page.url.pathname.includes('/messages')
                    && !($page.url.pathname.includes('naddr'))
                }
            >
                <MessagesIcon sizeClass={'text-2xl sm:text-3xl'} />
            </TabAnchor>
            <TabAnchor 
                href="/notifications"
                selected={$page.url.pathname.includes('/notifications')}
            >
                <NotificationsIcon sizeClass={'text-2xl sm:text-3xl'} />
            </TabAnchor>
        </TabGroup>
    </svelte:fragment>
</AppShell>

<!-- <AppHeader /> -->

