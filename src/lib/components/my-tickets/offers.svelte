<script lang="ts">
import ndk from '$lib/stores/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { OfferStatus, type OfferEvent } from '$lib/events/OfferEvent';
import { myOffers, ticketsOfMyOffersFilter, ticketsOfMyOffers } from '$lib/stores/troubleshoot-eventstores';
import OfferCard from '../OrderBook/OfferCard.svelte';

let tabGroup = OfferStatus.Pending;

const offerMap: Map<OfferStatus, OfferEvent[]> = new Map();
let pendingOffers: OfferEvent[] = [];
let wonOffers: OfferEvent[] = [];
let lostOffers: OfferEvent[] = [];

offerMap.set(OfferStatus.Pending, pendingOffers);
offerMap.set(OfferStatus.Won, wonOffers);
offerMap.set(OfferStatus.Lost, lostOffers);


// Sort offers into buckets according to state. Do this every time a new offers is received for the user
$: {
    if ($myOffers) {
        pendingOffers = [];
        wonOffers = [];
        lostOffers = [];

        $myOffers.forEach((offer: OfferEvent) => {
            if (offer.status === OfferStatus.Pending) {
                pendingOffers.push(offer);
            } else if (offer.status === OfferStatus.Won) {
                wonOffers.push(offer);
            } else if (offer.status === OfferStatus.Lost) {
                lostOffers.push(offer);
            }
            const dTagFilters = ticketsOfMyOffersFilter['#d'];
            const dTag = offer.referencedTicketAddress.split(':')[2] as string;

            if (!dTagFilters?.includes(dTag)) {
                ticketsOfMyOffersFilter['#d']?.push(dTag);       
            }

        });
         // Restart subscritpion
        ticketsOfMyOffers.unsubscribe();
        console.log('unsubbed from ticketsOfMyOffers');
        ticketsOfMyOffers.startSubscription();
        console.log('restarted sub ticketsOfMyOffers');
        console.log(ticketsOfMyOffers);

        // UI update
        pendingOffers = pendingOffers;
        wonOffers = wonOffers;
        lostOffers = lostOffers;

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
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each pendingOffers as offer }
                        <OfferCard {offer} countAllOffers={true}/>
                    {/each}
                </div>
            {:else if tabGroup === 1}
                <div>
                    {#each wonOffers as offer }
                        <OfferCard {offer} countAllOffers={true}/>
                    {/each}
                </div>
            {:else if tabGroup === 2}
                <div>
                    {#each lostOffers as offer }
                        <OfferCard {offer} countAllOffers={true}/>
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Offers!</h2>
{/if}
