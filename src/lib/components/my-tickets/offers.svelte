<script lang="ts">
import ndk from '$lib/stores/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { OfferStatus, type OfferEvent } from '$lib/events/OfferEvent';
import { myOffers, ticketsOfSpecificOffersFilter, ticketsOfSpecificOffers } from '$lib/stores/troubleshoot-eventstores';
import OfferCard from '../OrderBook/OfferCard.svelte';
    import type { TicketEvent } from '$lib/events/TicketEvent';

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
    // If we got a new offer, push it into the collection and start listening to ticket of that
    // OR we got a new ticket that we are interested in with these offers. Check its '#a' tag to set offer status 
    if ($myOffers && $ticketsOfSpecificOffers) {
        pendingOffers = [];
        wonOffers = [];
        lostOffers = [];

        $myOffers.forEach((offer: OfferEvent) => {
            const dTagFilters = ticketsOfSpecificOffersFilter['#d'];
            const dTag = offer.referencedTicketAddress.split(':')[2] as string;

    // If I havent been listening to ticket of this offer, I just start listening to it
    // Else I already am listening to this ticket so I look it up if it might have changed its accepted offer
    // This approach does not display an offer until it has successfully retrieved its status from its ticket!
            if (!dTagFilters?.includes(dTag)) {
                ticketsOfSpecificOffersFilter['#d']?.push(dTag);       
                // Restart subscritpion
                ticketsOfSpecificOffers.unsubscribe();
                ticketsOfSpecificOffers.startSubscription();
            } else {
                $ticketsOfSpecificOffers.forEach((ticket:TicketEvent) => {
                    if (ticket.ticketAddress === offer.referencedTicketAddress) {
                        if (ticket.acceptedOfferAddress === offer.offerAddress) {
                            wonOffers.push(offer);
                        } else if (ticket.acceptedOfferAddress) {
                            lostOffers.push(offer);
                        } else {
                            pendingOffers.push(offer);
                        }
                    }
                });
                // UI update only if offer status is set
                pendingOffers = pendingOffers;
                wonOffers = wonOffers;
                lostOffers = lostOffers;
            }
        });
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
            Won
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
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each wonOffers as offer }
                        <OfferCard {offer} countAllOffers={true}/>
                    {/each}
                </div>
            {:else if tabGroup === 2}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
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
