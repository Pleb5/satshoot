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
                <div class="w-16 h-16">
                    <a href="/" class="btn-icon w-full h-full object-cover">
                        <img class="w-full h-full" src="bitcoin-troubleshoot.svg" alt="logo" />
                    </a>
                </div>
                
            </svelte:fragment>
            
            <h2 class="h2 text-center"><span>BTC Troubleshoot</span></h2> 

            <svelte:fragment slot="trail">
                <Avatar 
                    class="rounded-full border-white"
                    src="profile-image.png"
                    border="border-4 border-surface-300-600-token hover:!border-primary-500"
                    cursor="cursor-pointer"
                /> 
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



