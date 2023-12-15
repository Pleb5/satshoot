<script lang="ts">
    import "../app.css";
    import NDK, { NDKEvent} from "@nostr-dev-kit/ndk";
    import { RelayList, UserCard,  } from "@nostr-dev-kit/ndk-svelte-components";
    import { browser } from '$app/environment';
    import TicketCard from "./ticket-card.svelte";
    import AppHeader from "./header.svelte";



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

    const numbers = new Array(20);
    numbers.fill(0);

</script>

<AppHeader />

<div class="flex flex-col justify-center items-center gap-y-4">
    {#each numbers as number}
        
            <TicketCard />

    {/each}
</div>


