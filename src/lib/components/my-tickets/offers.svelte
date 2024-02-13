<script lang="ts">
import ndk from '$lib/stores/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { OfferStatus, type OfferEvent } from '$lib/events/OfferEvent';
import { myOffers } from '$lib/stores/troubleshoot-eventstores';
import OfferCard from '../OrderBook/OfferCard.svelte';

let tabGroup = OfferStatus.Pending;

const offerMap: Map<OfferStatus, Set<OfferEvent>> = new Map();
let pendingOfferSet: Set<OfferEvent> = new Set();
let wonOfferSet: Set<OfferEvent> = new Set();
let lostOfferSet: Set<OfferEvent> = new Set();

offerMap.set(OfferStatus.Pending, pendingOfferSet);
offerMap.set(OfferStatus.Won, wonOfferSet);
offerMap.set(OfferStatus.Lost, lostOfferSet);


// Sort offers into buckets according to state. Do this every time a new offers is received for the user
$: {
    if ($myOffers && $myOffers.length > 0) {
        // NDKSvelte does not preserve the latest added event. We need it to be able to
        // start a subscription which updates the ticket referenced by the offer.
        // So we create Sets that store offers of different status.
        // We try to insert ALL offers into these sets WHENEVER a new offer arrived in this reactive block
        // If indeed a new one was added, we need to start its subscription.
        $myOffers.forEach((offer: OfferEvent) => {

            // If offer has valid status
            if (offer.status === OfferStatus.Pending || 
                offer.status === OfferStatus.Won || 
                offer.status === OfferStatus.Lost) {

                console.log('valid offer, trying add to myOffers...')

                let offerSet = offerMap.get(offer.status);
                if (!(offerSet?.has(offer)) ) {
                    console.log('NEW valid offer found. Adding to set, starting ticket sub')
                    offerSet?.add(offer);
                    // When to stop?
                    offer.startTicketSub().then(()=>{
                        pendingOfferSet = pendingOfferSet;
                        wonOfferSet = wonOfferSet;
                        lostOfferSet = lostOfferSet;
                    });
                }

                console.log('my offers:', $myOffers)
                console.log('pending offers:', pendingOfferSet)
            }
            pendingOfferSet = pendingOfferSet;
            wonOfferSet = wonOfferSet;
            lostOfferSet = lostOfferSet;
        })

    } else {
        console.log('My offers is null or size equals 0!')
    }
}

</script>

{#if $ndk.activeUser}
    <TabGroup justify='justify-evenly' flex='flex-grow'>
        <Tab bind:group={tabGroup} name="tab1" value={OfferStatus.Pending}>
            Pending
        </Tab>
        <Tab bind:group={tabGroup} name="tab2" value={OfferStatus.Won}>
            In Progress
        </Tab>
        <Tab bind:group={tabGroup} name="tab2" value={OfferStatus.Lost}>
            Lost
        </Tab>
        <!-- Tab Panels --->
        <svelte:fragment slot="panel">
            {#if tabGroup === 0}
                <div class="grid grid-cols-1 itesm-center center gap-y-4 mx-8">
                    {#each pendingOfferSet as offer }
                        <OfferCard {offer} countAllOffers={true}/>
                    {/each}
                </div>
            {:else if tabGroup === 1}
                <div>
                    {#each wonOfferSet as offer }
                        <OfferCard {offer} countAllOffers={true}/>
                    {/each}
                </div>
            {:else if tabGroup === 2}
                <div>
                    {#each lostOfferSet as offer }
                        <OfferCard {offer} countAllOffers={true}/>
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Offers!</h2>
{/if}
