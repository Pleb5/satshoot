<script lang="ts">
    import "../app.css";

    // Font awesome
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
	import '@fortawesome/fontawesome-free/css/solid.css';
	import '@fortawesome/fontawesome-free/css/brands.css';

    import NDK, { NDKEvent} from "@nostr-dev-kit/ndk";
    import { browser } from '$app/environment';

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
    initializeStores();

    // Skeleton popup init
    storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });



    // Create a new NDK instance with explicit relays
    const ndk = new NDK({
        // signer: signer,
        explicitRelayUrls: ["wss://relay.damus.io", "wss://relay.snort.social"],
    });

    // if (browser) {
    //     ndk.connect().then(() => {
    //         console.log('Connected');
    //     });
    // }

    // const user = ndk.getUser({
    //     npub: 'npub16p8v7varqwjes5hak6q7mz6pygqm4pwc6gve4mrned3xs8tz42gq7kfhdw'
    // });

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
                <!-- Triggers popup settings menu -->
                <button use:popup={settingsMenu}>

                    <!-- Avatar image -->
                    <Avatar 
                        class="rounded-full border-white"
                        src="profile-image.png"
                        border="border-4 border-surface-300-600-token hover:!border-primary-500"
                        cursor="cursor-pointer"
                    /> 
                </button>
                <!-- Popup menu content -->
                <SettingsMenu />
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
                active="bg-primary-active-token"
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
            active="bg-primary-active-token"
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

