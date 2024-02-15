<script lang="ts">
    import "../app.css";

    // Font awesome
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
	import '@fortawesome/fontawesome-free/css/solid.css';
	import '@fortawesome/fontawesome-free/css/brands.css';

    import ndk from "$lib/stores/ndk";
    import { DEFAULTRELAYURLS, blacklistedRelays, storedPool, sessionPK } from "$lib/stores/ndk";
    import { myTicketFilter, myOfferFilter, tickets, myTickets, myOffers, offersOnTickets, ticketsOfMyOffers } from "$lib/stores/troubleshoot-eventstores";

    import pageTitleStore from "$lib/stores/pagetitle-store";

    import { LoginMethod } from "$lib/stores/ndk";

    import { privateKeyFromSeedWords} from "nostr-tools/nip06"
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import { NDKNip07Signer, NDKPrivateKeySigner, NDKRelay } from "@nostr-dev-kit/ndk";

    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';
    import { AppRail, AppRailAnchor } from '@skeletonlabs/skeleton';
    import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
    import { page } from '$app/stores';

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
    import DecryptSeedModal from "$lib/components/Modals/DecryptSeedModal.svelte";

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
        
        // -----------  Set up relays and connect -------------

        // Get user-defined pool from local storage if possible
        if ($storedPool && $blacklistedRelays) {
            $storedPool.forEach((relay:string) => {
                console.log('Add explicit relay in layout onmount')
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

        console.log("NDK Connected");

        // Start all tickets sub. Starting this anywhere else seems to break reliability.
        // User-defined Relays are restored from local storage here and this runs AFTER page onmounts.
        // This causes the subscription to fail because there are yet no relays to subscribe to
        tickets.ref();
        offersOnTickets.ref();

        if (!loggedIn) {
            console.log('not logged in! Trying to log in...')
            // Try to get saved user from localStorage
            const loginMethod = localStorage.getItem("login-method");

            if (loginMethod){
                if (loginMethod === LoginMethod.Ephemeral) {
        // We either get the private key from sessionStorage or decrypt from localStorage
                    if ($sessionPK) {
                        console.log('sessionPK', $sessionPK)

                        $ndk.signer = new NDKPrivateKeySigner($sessionPK); 

                        let user: NDKUser = await $ndk.signer.user();

                        myTicketFilter.authors?.push(user.pubkey);
                        myOfferFilter.authors?.push(user.pubkey);
                        myTickets.startSubscription();
                        myOffers.startSubscription();

        // Does this do anything before I push the first '#d' tag(ticket of interest)?
                        ticketsOfMyOffers.ref();

                        console.log('started my subscriptions!')

                        await user.fetchProfile();

                        // Trigger UI change in profile when user Promise is retrieved
                        $ndk.activeUser = $ndk.activeUser;

                    } else {
                        try {
                            // Get decrypted seed from a modal prompt where user enters passphrase
                            // User can dismiss modal in which case decryptedSeed is undefined
                            new Promise<string|undefined>((resolve) => {
                                const modalComponent: ModalComponent = {
                                    ref: DecryptSeedModal,
                                };

                                const modal: ModalSettings = {
                                    type: 'component',
                                    component: modalComponent,
                                    response: (decryptedSeed: string|undefined) => {
                                        resolve(decryptedSeed); 
                                    },
                                };
                                // Call DecryptSeed Modal to prompt for passphrase
                                // This can throw invalid seed words if decryption was unsuccessful
                                modalStore.trigger(modal);
                                // We got some kind of response from modal
                            }).then(async (decryptedSeed: string|undefined) => {
                                    if (decryptedSeed) {
                                        console.log("got seedwords from localStorage: ", decryptedSeed);
                                        const privateKey = privateKeyFromSeedWords(decryptedSeed); 
                                        $ndk.signer = new NDKPrivateKeySigner(privateKey); 
                                        
                                        $sessionPK = privateKey;

                                        let user: NDKUser = await $ndk.signer.user();
                                        
                                        myTicketFilter.authors?.push(user.pubkey);
                                        myOfferFilter.authors?.push(user.pubkey);
                                        myTickets.startSubscription();
                                        myOffers.startSubscription();
                                        console.log('started my subscriptions!')

                                        await user.fetchProfile();

                                        // Trigger UI change in profile when user Promise is retrieved
                                        $ndk.activeUser = $ndk.activeUser;
                                    }
                                });

                        } catch(e) {
                            const t: ToastSettings = {
                                message:`Could not create private key from seed words, error: ${e}`,
                                autohide: false,
                            };
                            toastStore.trigger(t);
                        }
                    }
                } else if (loginMethod === LoginMethod.NIP07) {
                    if (!$ndk.signer) {
                        console.log('No ndk signer! setting one')
                        $ndk.signer = new NDKNip07Signer();
                    }
                    let user = await $ndk.signer.user();

                    myTicketFilter.authors?.push(user.pubkey);
                    myOfferFilter.authors?.push(user.pubkey);
                    myTickets.startSubscription();
                    myOffers.startSubscription();
                    console.log('started my subscriptions!')

                    await user.fetchProfile();

                    // Trigger UI update for profile
                    $ndk.activeUser = $ndk.activeUser;
                }
            }
        } else {
            // We are logged in, lets fetch profile
            console.log('Logged in! layout.svelte')
            await $ndk.activeUser?.fetchProfile();
            $ndk.activeUser = $ndk.activeUser;
        }
    });

    onDestroy(()=>{
        tickets.unref();
        offersOnTickets.unref();
        myTickets.unref();
        myOffers.unref();
        ticketsOfMyOffers.unref();
        console.log('unref all subs in onDestroy!')
    });


    const settingsMenu: PopupSettings = {
        event: "click",
        target: "settingsMenu",
        placement: "top"
    };


    
</script>

<Toast />
<Modal />
<AppShell slotSidebarLeft="bg-surface-100-800-token">
	<svelte:fragment slot="header">
        <AppBar gridColumns="grid-cols-3" slotDefault="items-center" slotTrail="place-content-end ">
            <svelte:fragment slot="lead">
                <div class="grid grid-cols-2 w-32 h-18">
                    <img class="w-full h-full" src="bitcoin-troubleshoot.svg" alt="logo" />
                    <div class="flex justify-center items-center">
                        <LightSwitch />
                    </div>
                </div>
            </svelte:fragment>

            <h2 class="h2 lg:pl-20 text-center">{$pageTitleStore}</h2>
            
            <svelte:fragment slot="trail">
                {#if loggedIn}
                    <!-- Triggers popup settings menu -->
                    <button use:popup={settingsMenu}>

                        <!-- Avatar image -->
                        <Avatar 
                            class="rounded-full border-white placeholder-white"
                            border="border-4 border-surface-300-600-token hover:!border-primary-500"
                            cursor="c, myTickets, myOffers,ursor-pointer"
                            bind:src={profileImage}
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

                    <AppRailAnchor href="/my-tickets" selected={$page.url.pathname === '/my-tickets'}>
                        <MenuItem_2 />
                    </AppRailAnchor>

                    <AppRailAnchor href="/messages" selected={$page.url.pathname === '/messages'}>
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

            <TabAnchor href="/my-tickets" selected={$page.url.pathname === '/my-tickets'}>
                    <MenuItem_2 />
            </TabAnchor>

            <TabAnchor href="/messages" selected={$page.url.pathname === '/messages'}>
                    <MenuItem_3 />
            </TabAnchor>
            <!-- ... -->
        </TabGroup>
    </svelte:fragment>
</AppShell>

<!-- <AppHeader /> -->

