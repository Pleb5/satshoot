<script lang="ts">
    import "../app.css";

    // Font awesome
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
	import '@fortawesome/fontawesome-free/css/solid.css';
	import '@fortawesome/fontawesome-free/css/brands.css';

    import ndk from "$lib/stores/ndk";
    import { connected } from "$lib/stores/ndk";
    import { DEFAULTRELAYURLS, blacklistedRelays, storedPool, sessionPK } from "$lib/stores/ndk";
    import { myTicketFilter, myOfferFilter, newTickets, oldTickets, myTickets, myOffers, offersOnTickets, ticketsOfSpecificOffers } from "$lib/stores/troubleshoot-eventstores";
    import { messageStore } from "$lib/stores/messages";

    import { RestoreMethod, LoginMethod } from "$lib/stores/ndk";

    import { privateKeyFromSeedWords} from "nostr-tools/nip06";
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import { NDKNip07Signer, NDKPrivateKeySigner, NDKRelay } from "@nostr-dev-kit/ndk";
    import { privateKeyFromNsec } from "$lib/utils/nip19";

    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';
    import { AppRail, AppRailAnchor } from '@skeletonlabs/skeleton';
    import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
    import { page, updated } from '$app/stores';

    // Popup menu
    import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
    import { storePopup, popup, type PopupSettings } from '@skeletonlabs/skeleton';
    import SettingsMenu from "$lib/components/PopupMenu/SettingsMenu.svelte";

    // Menu Items 
    import MenuItem_1 from "$lib/components/NavBar/MenuItem_1.svelte";
    import MenuItem_2 from "$lib/components/NavBar/MenuItem_2.svelte";
    import MenuItem_3 from "$lib/components/NavBar/MenuItem_3.svelte";

    import { LightSwitch } from '@skeletonlabs/skeleton';

    // Skeleton Toast
    import { Toast, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';

    // Skeleton Modals
    import { Modal, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import DecryptSecretModal from "$lib/components/Modals/DecryptSecretModal.svelte";

    // Skeleton stores init
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { onDestroy, onMount } from "svelte";

    // Tickets and Offers

    initializeStores();

    // Skeleton popup init
    storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    let profileImage: string | undefined;
    let loggedIn: boolean;

    $: {
        profileImage = $ndk.activeUser?.profile?.image;
        loggedIn = !!$ndk.activeUser;
    }
        
    onMount(async () => {
        localStorage.debug = 'ndk:*'

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            showAppInstallPromotion = true;
        });
        
        // -----------  Set up relays and connect -------------

        // Get user-defined pool from local storage if possible
        if ($storedPool && $blacklistedRelays) {
            $storedPool.forEach((relay:string) => {
                $ndk.addExplicitRelay(new NDKRelay(relay));
            })
            // Retrieve blacklisted relay urls removed explicitly by the user
            $blacklistedRelays.forEach((relay:string) => {
                $ndk.pool.blacklistRelayUrls.add(relay);
            })
        } else {
            // Initialize stored pool and ndk with default relays
            $ndk.explicitRelayUrls = DEFAULTRELAYURLS; 
            storedPool.set(DEFAULTRELAYURLS);

            //init blacklist
            blacklistedRelays.set([]);
        }

        await $ndk.connect();
        $connected = true;

        // Start all tickets sub. Starting this anywhere else seems to break reliability.
        // User-defined Relays are restored from local storage here and this runs AFTER page onmounts.
        // This causes the subscription to fail because there are yet no relays to subscribe to
        // ALL STORE SUBS MUST START IN LAYOUT.SVELTE! CAN RESTART IN PAGES/COMPONENTS LATER
        // BUT IT IS IMPORANT THAT THEY ARE STARTED HERE!
        newTickets.startSubscription();
        oldTickets.startSubscription();
        offersOnTickets.startSubscription();
        ticketsOfSpecificOffers.startSubscription();

        messageStore.startSubscription();

        if (!loggedIn) {
            // Try to get saved user from localStorage
            const loginMethod = localStorage.getItem("login-method");

            if (loginMethod){
                if (loginMethod === LoginMethod.Ephemeral) {
        // We either get the private key from sessionStorage or decrypt from localStorage
                    if ($sessionPK) {
                        $ndk.signer = new NDKPrivateKeySigner($sessionPK); 

                        let user: NDKUser = await $ndk.signer.user();

                        myTicketFilter.authors?.push(user.pubkey);
                        myOfferFilter.authors?.push(user.pubkey);
                        myTickets.startSubscription();
                        myOffers.startSubscription();

                        await user.fetchProfile();

                        // Trigger UI change in profile when user Promise is retrieved
                        $ndk.activeUser = $ndk.activeUser;

                    } else {
                        try {
                            // Get decrypted seed from a modal prompt where user enters passphrase
                            // User can dismiss modal in which case decryptedSeed is undefined
                            new Promise<string|undefined>((resolve) => {
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
                            }).then(async (responseObject: any) => {
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

                                                let user: NDKUser = await $ndk.signer.user();

                                                myTicketFilter.authors?.push(user.pubkey);
                                                myOfferFilter.authors?.push(user.pubkey);
                                                myTickets.startSubscription();
                                                myOffers.startSubscription();

                                                await user.fetchProfile();

                                                // Trigger UI change in profile when user Promise is retrieved
                                                $ndk.activeUser = $ndk.activeUser;
                                            } else {
                                                throw new Error("Could not create hex private key from decrypted secret. Clear browser local storage and login again.");
                                            }

                                        }
                                    }
                                });

                        } catch(e) {
                            const t: ToastSettings = {
                                message:`Could not create private key from local secret, error: ${e}`,
                                autohide: false,
                            };
                            toastStore.trigger(t);
                        }
                    }
                } else if (loginMethod === LoginMethod.NIP07) {
                    if (!$ndk.signer) {
                        $ndk.signer = new NDKNip07Signer();
                    }
                    let user = await $ndk.signer.user();

                    myTicketFilter.authors?.push(user.pubkey);
                    myOfferFilter.authors?.push(user.pubkey);
                    myTickets.startSubscription();
                    myOffers.startSubscription();

                    await user.fetchProfile();

                    // Trigger UI update for profile
                    $ndk.activeUser = $ndk.activeUser;
                }
            }
        } else {
            // We are logged in, lets fetch profile
            await $ndk.activeUser?.fetchProfile();
            $ndk.activeUser = $ndk.activeUser;
        }
    });

    onDestroy(()=>{
        newTickets.unsubscribe();
        oldTickets.unsubscribe();
        offersOnTickets.unref();
        myTickets.unref();
        myOffers.unref();
        ticketsOfSpecificOffers.unref();

        messageStore.unsubscribe();
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

    
</script>

<Toast />
<Modal />
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
                <img class="" src="/bitcoin-troubleshoot.svg" alt="logo" />
            </div>

            <svelte:fragment slot="trail">
                {#if loggedIn}
                    <!-- Triggers popup settings menu -->
                    <button use:popup={settingsMenu}>

                        <!-- Avatar image -->
                        <Avatar 
                            class="rounded-full border-white placeholder-white"
                            border="border-4 border-surface-300-600-token hover:!border-primary-500"
                            cursor="cursor-pointer"
                            src={profileImage ?? `https://robohash.org/${$ndk.activeUser?.pubkey}`}
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
                class="hidden lg:block"
                hover="hover:variant-soft-primary"
                active="bg-primary-300-600-token"
                background="bg-surface-100-800-token"
            >
                <svelte:fragment slot="lead">
                    <AppRailAnchor href="/" selected={$page.url.pathname === '/'}>
                        <MenuItem_1 />
                    </AppRailAnchor>

                    <AppRailAnchor href="/post-ticket" selected={$page.url.pathname === '/post-ticket'}>
                        <MenuItem_2 />
                    </AppRailAnchor>

                    <AppRailAnchor href="/my-tickets" selected={$page.url.pathname === '/my-tickets'}>
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
            active="bg-primary-300-600-token"
            hover="hover:variant-soft-primary"
            flex="flex-1"
            rounded=""
            border=""
            background="bg-surface-100-800-token"
            class="lg:hidden w-full"
        >
            <TabAnchor href="/" selected={$page.url.pathname === '/'}>
                    <MenuItem_1 />
            </TabAnchor>

            <TabAnchor href="/post-ticket" selected={$page.url.pathname === '/post-ticket'}>
                    <MenuItem_2 />
            </TabAnchor>

            <TabAnchor href="/my-tickets" selected={$page.url.pathname === '/my-tickets'}>
                <MenuItem_3 />
            </TabAnchor>

        </TabGroup>
    </svelte:fragment>
</AppShell>

<!-- <AppHeader /> -->

