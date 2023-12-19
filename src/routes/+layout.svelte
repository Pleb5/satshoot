<script lang="ts">
    import "../app.css";
    // Font awesome
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
	import '@fortawesome/fontawesome-free/css/solid.css';

    import NDK, { NDKEvent} from "@nostr-dev-kit/ndk";
    import { browser } from '$app/environment';
    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';

    import PopupMenu from "$lib/components/PopupMenu/PopupMenu.svelte";

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

    const popupMenu: PopupSettings = {
        event: "click",
        target: "popupMenu",
        placement: "bottom"
    };


</script>

<AppShell >
	<svelte:fragment slot="header">
        <AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end ">
            <svelte:fragment slot="lead">
                <div class="w-16 h-16">
                    <a href="/" class="btn-icon w-full h-full object-cover">
                        <img class="w-full h-full" src="bitcoin-troubleshoot.svg" alt="logo" />
                    </a>
                </div>
                
            </svelte:fragment>
            
            <h2 class="h2 text-center"><span>BTC Troubleshoot</span></h2> 

            <svelte:fragment slot="trail">
                <!-- Triggers popup menu -->
                <button use:popup={popupMenu}>

                    <!-- Avatar image -->
                    <Avatar 
                        class="rounded-full border-white"
                        src="profile-image.png"
                        border="border-4 border-surface-300-600-token hover:!border-primary-500"
                        cursor="cursor-pointer"
                    /> 
                </button>
                <!-- Popup menu content -->
                <PopupMenu />            
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
	<!-- <svelte:fragment slot="sidebarLeft"> -->
 <!--        <div id="sidebar-left" class="sm:block">Sidebar</div> -->
 <!--    </svelte:fragment> -->
	<!-- (sidebarRight) -->
	<!-- (pageHeader) -->
	<!-- Router Slot -->
	<slot />
	<!-- ---- / ---- -->
	<!-- (pageFooter) -->
	<!-- (footer) -->
</AppShell>

<!-- <AppHeader /> -->



