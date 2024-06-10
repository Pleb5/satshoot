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
        DEFAULTRELAYURLS,
        sessionPK,
    } from "$lib/stores/ndk";

    import { Dexie } from "dexie";

    import { loggedIn } from "$lib/stores/user";
    import currentUser from "$lib/stores/user";

    import { 
        allTickets,
        allOffers,
        myTickets,
        myOffers,
    } from "$lib/stores/troubleshoot-eventstores";

    import { 
        allReviews,
    } from "$lib/stores/reviews";
    import { sendNotification } from "$lib/stores/notifications";

    import { initializeUser } from '$lib/utils/helpers';

    import { wot, wotUpdating } from '$lib/stores/wot';

    import { RestoreMethod, LoginMethod } from "$lib/stores/ndk";

    import { privateKeyFromSeedWords} from "nostr-tools/nip06";
    import { NDKNip46Signer, NDKNip07Signer, NDKPrivateKeySigner, NDKRelay } from "@nostr-dev-kit/ndk";
    import { privateKeyFromNsec } from "$lib/utils/nip19";

    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';
    import { AppRail, AppRailAnchor } from '@skeletonlabs/skeleton';
    import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
    import { page, updated } from '$app/stores';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

    // Popup menu
    import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
    import { storePopup, popup, type PopupSettings } from '@skeletonlabs/skeleton';
    import SettingsMenu from "$lib/components/PopupMenu/SettingsMenu.svelte";

    // Menu Items 
    import MenuItem_1 from "$lib/components/NavBar/MenuItem_1.svelte";
    import MenuItem_2 from "$lib/components/NavBar/MenuItem_2.svelte";
    import MenuItem_3 from "$lib/components/NavBar/MenuItem_3.svelte";

    import { LightSwitch, modeCurrent } from '@skeletonlabs/skeleton';

    // Skeleton Toast
    import { Toast, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';

    // Skeleton Modals
    import { Modal, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import DecryptSecretModal from "$lib/components/Modals/DecryptSecretModal.svelte";

    // Skeleton stores init
    import { initializeStores, Drawer } from '@skeletonlabs/skeleton';
    import drawerID from '$lib/stores/drawer';
    import { DrawerIDs } from '$lib/stores/drawer';
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import ReviewBreakdown from "$lib/components/DrawerContents/ReviewBreakdown.svelte";
    import UserReviewBreakdown from "$lib/components/DrawerContents/UserReviewBreakdown.svelte";
    import type { TicketEvent } from "$lib/events/TicketEvent";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import type { ReviewEvent } from "$lib/events/ReviewEvent";
    import { BTCTroubleshootKind } from "$lib/events/kinds";
    // Tickets and Offers

    initializeStores();

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


    let noConnectedRelaysToastID: string;

    onMount(async () => {

// ---------------------------- Basic Init ----------------------------
        console.log('onMount')

        localStorage.debug = 'ndk:*'
        if(!$modeCurrent) {
            localStorage.setItem('modeCurrent', 'false');
            $modeCurrent = false;
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            showAppInstallPromotion = true;
        });

        // Setup client-side caching
        $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });
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
        $connected = true;

        $ndk.pool.on('relay:disconnect', (relay: NDKRelay) => {
            if (!relay) return;
            // Disabled for now, too annoying
            // console.log('relay disconnected')
            // const relayName = relay.url.replace("wss://", "").slice(0, -1);
            // const t: ToastSettings = {
            //     message:`Relay: ${relayName} Disconnected!`,
            //     background: 'bg-error-500',
            //     timeout: 5000,
            // };
            // toastStore.trigger(t);


            if ($ndk.pool.connectedRelays().length === 0
                && !noConnectedRelaysToastID) {
                $connected = false;
                // Trying to reconnect
                for (const relay of $ndk.pool.relays.values()) {
                    relay.connect(2000);
                }
                const t: ToastSettings = {
                    message:`No Connected Relays!`,
                    background: 'bg-error-500',
                    classes: "text-sm",
                    autohide: false,
                    action: {
                        label: 'Check Network',
                        response: () => {
                            goto('/network');
                        },
                    },
                };
                noConnectedRelaysToastID = toastStore.trigger(t);
            }
        });

        $ndk.pool.on('relay:connect', (relay: NDKRelay) => {
            if(!relay) return;

            $connected = true;
            // console.log('user-defined relay came online')
            if(noConnectedRelaysToastID) {
                toastStore.close(noConnectedRelaysToastID);
                noConnectedRelaysToastID = '';
            }
        });

        // Start all tickets/offers sub
        allTickets.startSubscription();
        allOffers.startSubscription();

// ------------------------ Restore Login -----------------------------------

        if (!$loggedIn) {
            // Try to get saved Login method from localStorage and login that way
            const loginMethod = localStorage.getItem("login-method");

            if (loginMethod){
                if (loginMethod === LoginMethod.Ephemeral) {
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
                                }
                            } 
                        } catch(e) {
                            const t: ToastSettings = {
                                message:`Could not create private key from local secret, error: ${e}`,
                                autohide: false,
                            };
                            toastStore.trigger(t);
                        }
                    }
                } else if(loginMethod === LoginMethod.Bunker) {
                    const localBunkerKey = localStorage.getItem("bunkerLocalSignerPK");
                    const bunkerTargetNpub = localStorage.getItem("bunkerTargetNpub");
                    const bunkerRelayURLsString = localStorage.getItem('bunkerRelayURLs');
                    const bunkerConnectionSecret = localStorage.getItem('bunkerConnectionSecret');

                    if (localBunkerKey && bunkerTargetNpub && bunkerRelayURLsString) {
                        const bunkerRelayURLs = bunkerRelayURLsString.split(',');
                        bunkerRelayURLs.forEach((url: string) => {
                            // ONLY WORKS WITH EXPLICIT RELAYS, NOT WITH SIMPLE POOL.ADDRELAY() CALL
                            $bunkerNDK.addExplicitRelay(url);
                        });

                        await $bunkerNDK.connect();
                        console.log("ndk connected to specified bunker relays");
                        
                        let connectionParams = bunkerTargetNpub;
                        if (bunkerConnectionSecret) {
                            connectionParams += '#' + bunkerConnectionSecret;
                        }

                        const localSigner = new NDKPrivateKeySigner(localBunkerKey);
                        const targetUser = $ndk.getUser({ npub: bunkerTargetNpub });
                        const remoteSigner = new NDKNip46Signer($bunkerNDK, targetUser!.pubkey, localSigner);
                        $ndk.signer = remoteSigner;

                        await remoteSigner.blockUntilReady();
                    }
                } else if (loginMethod === LoginMethod.NIP07) {
                    if (!$ndk.signer) {
                        $ndk.signer = new NDKNip07Signer();
                    }
                }
            }
            // If signer is defined we can init user
            if ($ndk.signer) {
                initializeUser($ndk);
            }
        }
    });

    const settingsMenu: PopupSettings = {
        event: "click",
        target: "settingsMenu",
        placement: "top"
    };

    // Check for app updates and offer reload option to user in a Toast
    $: if ($updated) {
        let toastId:string;
        const t: ToastSettings = {
            message: 'New version of the app just dropped!',
            autohide: false,
            action: {
                label: 'Reload',
                response: () => {
                    toastStore.close(toastId);
                    location.reload();
                },
            }
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

    // ----- Notifications ------ //
    $: if($allTickets && $myOffers) {
       $allTickets.forEach((t: TicketEvent) => {
            $myOffers.forEach((o: OfferEvent) => {
                if (o.referencedTicketDTag === t.dTag) {
                    sendNotification(o);
                }
            });
        });
    }

    $: if ($allOffers && $myTickets) {
       $allOffers.forEach((o: TicketEvent) => {
            $myTickets.forEach((t: TicketEvent) => {
                if (o.referencedTicketDTag === t.dTag) {
                    sendNotification(t);
                }
            });
        });
    }

    $: if ($allReviews && $myTickets && $myOffers) {
        $allReviews.forEach((r: ReviewEvent) => {
            if (r.reviewedEventKind === BTCTroubleshootKind.Ticket) {
                $myTickets.forEach((t: TicketEvent) => {
                    if (t.ticketAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });

            } else if (r.reviewedEventKind === BTCTroubleshootKind.Offer) {
                $myOffers.forEach((o: OfferEvent) => {
                    if (o.offerAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });
            }
        });
    }

</script>

<Toast />
<Modal />
<Drawer regionDrawer={'flex justify-center'}>
    {#if $drawerID === DrawerIDs.UserMenu}
        <SettingsMenu/>
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
                <div class="flex flex-col gap-y-2">
                    <LightSwitch />
                    <a href="/about">
                        <div class="badge bg-tertiary-200-700-token flex justify-center items-center">
                            <span class="w-6 text-center">
                                <i class="fa-solid fa-info text-lg" />
                            </span>
                        </div>
                    </a>
                </div>
            </svelte:fragment>

            <div class="flex justify-center lg:ml-20">
                <div class ='flex gap-x-2 justify-center items-center'>
                    <img src="/satshoot.svg" alt="logo" />
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
                            {:else if $wot && $wot.size < 2 && $wotUpdating}
                                <ProgressRadial
                                    value={undefined}
                                    stroke={60}
                                    meter="stroke-error-500"
                                    track="stroke-error-500/30"
                                    strokeLinecap="round" width="w-8" 
                                />
                            {:else if $wot && $wot.size > 1 && $wotUpdating}
                                <ProgressRadial
                                    value={undefined}
                                    stroke={60}
                                    meter="stroke-success-500"
                                    track="stroke-success-500/30"
                                    strokeLinecap="round" width="w-8" 
                                />
                            {:else if $wot && $wot.size > 1}
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
                </div>
            </div>

            <svelte:fragment slot="trail">
                {#if $loggedIn}
                    <!-- Triggers popup settings menu -->
                    <button use:popup={settingsMenu}>

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
                    <!-- Popup menu content -->
                    <SettingsMenu />
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
                        <MenuItem_1 />
                    </AppRailAnchor>

                    <AppRailAnchor
                        href="/post-ticket"
                        selected={$page.url.pathname.includes('/post-ticket')}
                    >
                        <MenuItem_2 />
                    </AppRailAnchor>

                    <AppRailAnchor 
                        href="/my-tickets" 
                        selected={$page.url.pathname.includes('/my-tickets')}
                    >
                        <MenuItem_3 />
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
                <MenuItem_1 />
            </TabAnchor>

            <TabAnchor 
                href="/post-ticket"
                selected={$page.url.pathname.includes('/post-ticket')}
            >
                <MenuItem_2 />
            </TabAnchor>

            <TabAnchor 
                href="/my-tickets"
                selected={$page.url.pathname.includes('/my-tickets')}
            >
                <MenuItem_3 />
            </TabAnchor>

        </TabGroup>
    </svelte:fragment>
</AppShell>

<!-- <AppHeader /> -->

