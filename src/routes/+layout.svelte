<script lang="ts">
    import "../app.css";
    import NDK, { NDKEvent} from "@nostr-dev-kit/ndk";
    import { browser } from '$app/environment';
    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';



    // Create a new NDK instance with explicit relays
    const ndk = new NDK({
        // signer: signer,
        explicitRelayUrls: ["wss://relay.damus.io", "wss://relay.snort.social"],
    });

    if (browser) {
        ndk.connect().then(() => {
            console.log('Connected');
        });
    }

    const user = ndk.getUser({
        npub: 'npub16p8v7varqwjes5hak6q7mz6pygqm4pwc6gve4mrned3xs8tz42gq7kfhdw'
    });


</script>

<AppShell regionPage="relative" slotPageHeader="sticky top-0 z-10">
	<svelte:fragment slot="header">
        <AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end">
            <svelte:fragment slot="lead">
                <img class="w-24 h-24" src="bitcoin-troubleshoot.svg" alt="logo" />
            </svelte:fragment>
            
            <div class="text-center text-zinc-900 text-3xl font-semibold leading-none">BTC Troubleshoot</div> 

            <svelte:fragment slot="trail">
                <Avatar 
                    class="2xl:w-24 2xl:h-24 lg:w-20 lg:h-20 md:w-16 md:h-16 sm:w-14 sm:h-14 w-12 h-12 rounded-full border-white"
                    src="profile-image.png"
                    border="border-4 border-surface-300-600-token hover:!border-primary-500"
                    cursor="cursor-pointer"
                /> 
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
	<svelte:fragment slot="sidebarLeft">
        <div id="sidebar-left" class="hidden lg:block">Sidebar</div>
    </svelte:fragment>
	<!-- (sidebarRight) -->
	<!-- (pageHeader) -->
	<!-- Router Slot -->
	<slot />
	<!-- ---- / ---- -->
	<!-- (pageFooter) -->
	<!-- (footer) -->
</AppShell>

<!-- <AppHeader /> -->



