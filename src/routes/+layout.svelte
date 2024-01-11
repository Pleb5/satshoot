<script lang="ts">
    import "../app.css";

    import { beforeUpdate, tick } from 'svelte';


    // Font awesome
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
	import '@fortawesome/fontawesome-free/css/solid.css';
	import '@fortawesome/fontawesome-free/css/brands.css';

    
    import ndk from "$lib/stores/ndk";

    import { browser } from '$app/environment';
    import { privateKeyFromSeedWords} from "nostr-tools/nip06"
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';
    import { AppRail, AppRailAnchor, AppRailTile } from '@skeletonlabs/skeleton';
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

    // Skeleton Toast
    import { Toast } from '@skeletonlabs/skeleton';

    // Skeleton Modals
    import { Modal } from '@skeletonlabs/skeleton';

    // Skeleton stores init
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { onMount } from "svelte";
    initializeStores();

    // Skeleton popup init
    storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

    let profileImage: string | undefined;
    let loggedIn: boolean;

    $: {
        profileImage = $ndk.activeUser?.profile?.image;
        loggedIn = !!$ndk.activeUser;
    }
        
    onMount(() => {
        if (!loggedIn) {
            // Try to get saved user from localStorage
            const signinMethod = localStorage.getItem("signin-method");

            if (signinMethod === "ephemeral") {
                const seedWords = localStorage.getItem("nostr-seedwords")
                if (seedWords) {
                    const privateKey = privateKeyFromSeedWords(seedWords); 
                    $ndk.signer = new NDKPrivateKeySigner(privateKey); 
                        
                    // Trigger UI change in profile
                    $ndk.activeUser = $ndk.activeUser;
                    console.log("got seedwords from localStorage: ", seedWords);
                    $ndk.signer?.user().then( (user:NDKUser) => {
                        // Trigger UI change in profile when user Promise is retrieved
                        $ndk.activeUser = $ndk.activeUser;
                        console.log("ephemeral user npub: ", user.npub);
                    });
                }
            } else if (signinMethod === "nip07") {
                $ndk.signer = new NDKNip07Signer();
                $ndk.signer.user().then( (user:NDKUser) => {
                    // Trigger UI update for profile
                    $ndk.activeUser = $ndk.activeUser;
                    user.fetchProfile().then(() => {
                        // Trigger UI update for profile image
                        $ndk.activeUser = $ndk.activeUser;
                    });
                });
            }
        }
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
        <AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end ">
            <svelte:fragment slot="lead">
                <div class="flex items-center w-16 h-16">
                    <img class="w-full h-full" src="bitcoin-troubleshoot.svg" alt="logo" />
                </div>
            </svelte:fragment>
            
            <svelte:fragment slot="trail">
                {#if loggedIn}
                    <!-- Triggers popup settings menu -->
                    <button use:popup={settingsMenu}>

                        <!-- Avatar image -->
                        <Avatar 
                            class="rounded-full border-white placeholder-white"
                            border="border-4 border-surface-300-600-token hover:!border-primary-500"
                            cursor="cursor-pointer"
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

            <div class="flex items-center space-x-4">
                <a href="/" class="btn-icon w-16 h-16">
                </a>
            </div>

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

