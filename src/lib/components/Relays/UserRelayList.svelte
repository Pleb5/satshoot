<script lang="ts">
    import ndkStore from '$lib/stores/ndk';
    import type { NDKRelay } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';

    import { type ModalSettings, getModalStore } from '@skeletonlabs/skeleton';
    import RelayListElement from './RelayListElement.svelte';
    const modalStore = getModalStore();

    let relays: NDKRelay[] = [];
    let notices: Map<NDKRelay, string[]> = new Map();

    onMount(() => {
        update();
        $ndkStore.pool.on('connect', () => {
            update();
        });
        $ndkStore.pool.on('relay:connect', () => {
            update();
        });
        $ndkStore.pool.on('disconnect', () => {
            update();
        });
        $ndkStore.pool.on('notice', relayNotice);
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

    
    function update() {
        relays = Array.from($ndkStore.pool.relays.values());
    }


    function removeRelay(relay: NDKRelay) {

        let removeRelayResponse = function(r: boolean){
            if (r) {
                // Removal confirmed, remove the relay. Only remove from pool
                // Don't remove from user-defined relays list(nip 65)
                $ndkStore.pool.removeRelay(relay.url);
                update();
            }
        }


        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirm Removal of Relay',
            body: "Do you really want to remove this Relay?",
            response: removeRelayResponse,
        };
        modalStore.trigger(modal);
    }

</script>

<div class="flex flex-col gap-y-6 justify-center">
    {#each relays as relay}
            <div class="card card-hover bg-surface-active-token flex justify-between gap-x-16 p-4">
                <RelayListElement relay = {relay}/>
                <button 
                    class="btn bg-error-400-500-token" 
                    on:click={ () => {removeRelay(relay) } }
                >
                    Remove
                </button>
            </div> 
    {/each}
</div>
