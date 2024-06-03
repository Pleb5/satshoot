<script lang="ts">

    import ndk from '$lib/stores/ndk';

    import { NDKRelay } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';

    import RelayListElement from '$lib/components/Relays/RelayListElement.svelte';


    let relays: NDKRelay[] = Array.from($ndk.pool.relays.values());
    let notices: Map<NDKRelay, string[]> = new Map();

    onMount(() => {
        $ndk.pool.on('connect', () => {
        });
        $ndk.pool.on('relay:connect', () => {
        });
        $ndk.pool.on('disconnect', () => {
        });
        $ndk.pool.on('notice', relayNotice);
    });

    function relayNotice(relay: NDKRelay, notice: string) {
        if (!notices.has(relay)) {
            notices.set(relay, []);
        }

        notices.get(relay)?.push(notice);
        notices = notices;

        setTimeout(() => {
            notices.get(relay)?.shift();
            notices = notices;
        }, 60000);
    }
    
</script>

<div class="flex flex-col gap-y-4 justify-center items-center mb-6 mx-2 overflow-y-auto">
    {#each relays as relay}
        <div class="card card-hover bg-surface-active-token flex flex-col items-center p-4">
            <RelayListElement relay = {relay}/>
        </div> 
    {/each}
</div>
<div class="flex justify-center mb-6" >
    <button class="btn btn-md bg-primary-300-600-token" on:click={() => location.reload()}>
        Retry Connections
    </button>
</div>
