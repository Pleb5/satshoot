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

    import SettingsMenu from "$lib/components/PopupMenu/SettingsMenu.svelte";

    // Popup menu
    import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
    
    import { storePopup, popup, type PopupSettings } from '@skeletonlabs/skeleton';
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

<AppShell >
	<svelte:fragment slot="header">
        <AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end ">
            <svelte:fragment slot="lead">
                <div class="flex items-center space-x-4">
                    <a href="/" class="btn-icon w-16 h-16">
                        <img class="w-16 h-16" src="bitcoin-troubleshoot.svg" alt="logo" />
                    </a>
                </div>
            </svelte:fragment>
            
            <svelte:fragment slot="trail">
                <!-- Avatar image -->
                <Avatar 
                    class="rounded-full border-white"
                    src="profile-image.png"
                    border="border-4 border-surface-300-600-token"
                /> 
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
    <!-- Sidebar. Hidden on small screens -->
	<svelte:fragment slot="sidebarLeft">
        <div id="sidebar-left" class="hidden sm:block">Sidebar</div>
    </svelte:fragment>

	<!-- Router Slot -->
	<slot />

    <!-- (footer) -->
	<svelte:fragment slot="footer">
        <div class="flex sm:hidden variant-glass-surface">
            <a href="/">
                <button class="btn-icon mr-3">
                    <i class="fa-solid fa-home text-3xl"/>
                </button>
            </a>
            <a href="/">
                <button class="btn-icon mr-3">
                    <i class="fa-brands fa-bitcoin text-3xl"/>
                </button>
            </a>
            <a href="/">
                <button class="btn-icon mr-3">
                    <i class="fa-solid fa-message text-3xl"/>
                </button>
            </a>


            <!-- Triggers popup settings menu -->
            <button class="btn-icon ml-auto mr-2" use:popup={settingsMenu}>
                <i class="fa-solid fa-gear text-3xl"/>
            </button>

            <SettingsMenu />            

        </div>
    </svelte:fragment>
</AppShell>

<!-- <AppHeader /> -->


TODO:
- Settings icon in footer bottom right
- Troubleshoot button to left of header
- Create sidebar left for footer content on large screens
- Insert "my contracts" and "messages" icons into sidebar/footer 
- Notifications will be icon badges on my contracts and messages
- My contracts will handle new tickets, pending and done tickets?
- Different views for troubleshooter/bitcoiner role?
- 
