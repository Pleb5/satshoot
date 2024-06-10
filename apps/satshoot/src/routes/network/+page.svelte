<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { connected } from "$lib/stores/ndk";

    import { NDKRelay, NDKRelayList, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';

    import RelayListElement from '$lib/components/Relays/RelayListElement.svelte';


    let needRelays = true;

    let readRelays: Set<NDKRelay> = new Set();
    let writeRelays: Set<NDKRelay> = new Set();


    async function fetchOutboxRelays() {
        const relays = await $ndk.fetchEvent(
            { kinds: [10002], authors: [$currentUser!.pubkey] },
            { 
                cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
                groupable: false,
            }
        );
        console.log('outbox relays', relays)

        const readRelayUrls: Set<string> = new Set();
        const writeRelayUrls: Set<string> = new Set();

        if (relays) {
            const relayList = NDKRelayList.from(relays);

            relayList.readRelayUrls.forEach((url: string) => {
                readRelayUrls.add(url);
            });
            relayList.writeRelayUrls.forEach((url: string) => {
                writeRelayUrls.add(url);
            });
        }

        readRelays.clear();
        writeRelays.clear();
        readRelayUrls.forEach((url: string) => {
            const relay = $ndk.pool.getRelay(url);
            readRelays.add(relay);
        });

        writeRelayUrls.forEach((url: string) => {
            const relay = $ndk.pool.getRelay(url);
            writeRelays.add(relay);
        });

        readRelays = readRelays;
        writeRelays = writeRelays;
        console.log('read relays', readRelays)
        console.log('write relays', writeRelays)
    }

    function removeRelay(relay: NDKRelay, read: boolean) {
        if (read) {
            readRelays.delete(relay);
            readRelays = readRelays;
        } else {
            writeRelays.delete(relay);
            writeRelays = writeRelays;
        }
    }

    $: if ($currentUser && $connected && needRelays) {
        needRelays = false;
        fetchOutboxRelays();
    }
    
    // $: if ($currentUser && $ndk.outboxTracker?.data) {
    //     const outboxData = $ndk.outboxTracker?.data.get($currentUser.pubkey)
    //     const writeRelays = outboxData?.writeRelays;
    //     const readRelays = outboxData?.readRelays;
    //     if (writeRelays && writeRelays.size > 0) {
    //         console.log('outbox write relays for user', writeRelays)
    //     }
    //     if (readRelays && readRelays.size > 0) {
    //         console.log('outbox read relays for user', readRelays)
    //     }
    // }
</script>

<h3 class="h3 mb-4 text-center">Your Read Relays(Inbox)</h3>
<div class="flex flex-col gap-y-4 justify-center items-center mb-6 mx-2">
    {#each readRelays as relay(relay.url)}
        <div class="card card-hover grid grid-cols-[1fr_auto] gap-x-2 bg-surface-active-token p-4">
            <RelayListElement {relay}/>
            <button 
                class="btn bg-error-500"
                type="button" 
                on:click={()=>{removeRelay(relay, true)}}>
                Remove
            </button>
        </div> 
    {/each}
</div>
<h3 class="h3 mb-4 text-center">Your Write Relays(Outbox)</h3>
<div class="flex flex-col gap-y-4 justify-center items-center mb-6 mx-2">
    {#each writeRelays as relay(relay.url)}
        <div class="card card-hover grid grid-cols-[1fr_auto] gap-x-2 bg-surface-active-token p-4">
            <RelayListElement {relay}/>
            <button 
                class="btn bg-error-500"
                type="button" 
                on:click={()=>{removeRelay(relay, false)}}>
                Remove
            </button>
        </div> 
    {/each}
</div>
<div class="flex justify-center mb-6" >
    <button class="btn btn-md bg-primary-300-600-token" on:click={() => location.reload()}>
        Retry Connections
    </button>
</div>
