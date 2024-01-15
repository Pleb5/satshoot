<script lang="ts">
    import ndkStore from '$lib/stores/ndk';
    import type { NDKRelay } from '@nostr-dev-kit/ndk';
    import { NDKRelayStatus } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';

    import { SlideToggle } from '@skeletonlabs/skeleton';
    import { type ModalSettings, getModalStore } from '@skeletonlabs/skeleton';
    const modalStore = getModalStore();

    let relays: NDKRelay[] = [];
    let notices: Map<NDKRelay, string[]> = new Map();

    onMount(() => {
        console.log($ndkStore.pool.relays)
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

    let expandSubscriptionList: Record<string, boolean> = {};

    function toggleSubList(relay: NDKRelay) {
        expandSubscriptionList[relay.url] = !expandSubscriptionList[relay.url];
        expandSubscriptionList = expandSubscriptionList;
        console.log("Relay subscription size: ", relay.activeSubscriptions().size);
    }

    function removeRelay(relay: NDKRelay) {

        let logoutResponse = function(r: boolean){
            if (r) {
                // Removal confirmed, remove the relay
                console.log("remove relay");
            }
        }


        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirm Removal of Relay',
            body: "Do you really want to remove this Relay?",
            response: logoutResponse,
        };
        modalStore.trigger(modal);
    }

</script>

<ul>
    {#each relays as relay}
        <li class="mb-4">
            <div class="card bg-surface-active-token flex justify-between items-center p-4 space-x-16">
                <SlideToggle name="slider-large"
                    checked 
                    active="bg-tertiary-500" 
                    size="sm" 
                    on:click={ () => { toggleSubList(relay) } }
                />
                <div class="">{ relay.url }</div>

                {#if relay.status === NDKRelayStatus.CONNECTING}
                    <div class="badge variant-filled-warning">Connecting</div>
                {:else if relay.status === NDKRelayStatus.DISCONNECTED}
                    <div class="badge variant-filled-error">Disconnected</div>
                {:else if relay.status === NDKRelayStatus.CONNECTED}
                    <div class="badge variant-filled-success">Connected</div>
                {:else if relay.status === NDKRelayStatus.FLAPPING}
                    <div class="badge variant-filled-warning">Flapping</div>
                {/if}
                <button 
                    class="btn bg-error-400-500-token" 
                    on:click={ () => {removeRelay(relay) } }
                >
                    Remove
                </button>
            </div> 

            <!-- {#if notices.has(relay)} -->
            <!--     <ul> -->
            <!--         {#each notices.get(relay) as notice} -->
            <!--             <li class="relay-notice">{notice}</li> -->
            <!--         {/each} -->
            <!--     </ul> -->
            <!-- {/if} -->
            <!---->
            <!-- {#if expandSubscriptionList[relay.url]} -->
            <!--     <ul> -->
            <!--         {#each Array.from(relay.activeSubscriptions) as subscription} -->
            <!--             <li> -->
            <!--                 <div class="relay-subscription-filter"> -->
            <!--                     {JSON.stringify(subscription.filter)} -->
            <!--                 </div> -->
            <!--                 <span class="relay-subscription--event-count"> -->
            <!--                     {subscription.eventsPerRelay.get(relay)?.size ?? 0} events -->
            <!--                 </span> -->
            <!---->
            <!--                 {#if subscription.eosesSeen.has(relay)} -->
            <!--                     <span class="small-note">EOSE received</span> -->
            <!--                 {/if} -->
            <!--             </li> -->
            <!--         {/each} -->
            <!--     </ul> -->
            <!-- {/if} -->
        </li>
    {/each}
</ul>
