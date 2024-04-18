<script lang="ts">
import ndk from '$lib/stores/ndk';
import currentUser from "$lib/stores/login";

import type { NDKTag } from '@nostr-dev-kit/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { OfferStatus, type OfferEvent } from '$lib/events/OfferEvent';
import { myOffers, ticketsOfSpecificOffersFilter, ticketsOfSpecificOffers } from '$lib/stores/troubleshoot-eventstores';
import OfferCard from '../OrderBook/OfferCard.svelte';
import type { TicketEvent } from '$lib/events/TicketEvent';

let tabGroup = OfferStatus.Pending;

let pendingOffers: OfferEvent[] = [];
let wonOffers: OfferEvent[] = [];
let lostOffers: OfferEvent[] = [];

let filterInput = '';
let filteredPendingOffers: OfferEvent[] = [];
let filteredWonOffers: OfferEvent[] = [];
let filteredLostOffers: OfferEvent[] = [];

let hideSearch = true;

function filterByTicket(offers: OfferEvent[]): OfferEvent[] {
    const filteredOffers = offers.filter((offer: OfferEvent) => {
        let match = false;
        $ticketsOfSpecificOffers.forEach((t:TicketEvent) => {
            if (t.ticketAddress === offer.referencedTicketAddress) {
                const lowerCaseFilter = filterInput.toLowerCase();

                const lowerCaseTitle = t.title.toLowerCase();
                const lowerCaseDescription = t.description.toLowerCase();

                let tagsContain: boolean = false;
                t.tags.forEach((tag: NDKTag) => {
                    if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                        tagsContain = true;
                    }
                });

                const titleContains: boolean = lowerCaseTitle.includes(lowerCaseFilter);
                const descContains: boolean = lowerCaseDescription.includes(lowerCaseFilter);

                if (titleContains || descContains || tagsContain) {
                    match = true;
                }
            }
        });
        if(match) {
            return true;
        }
        return false;
    });
    return filteredOffers;
}

function filterOffersByTicket() {
    filteredPendingOffers = filterByTicket(pendingOffers);
    filteredWonOffers = filterByTicket(wonOffers);
    filteredLostOffers = filterByTicket(lostOffers);
}

// Sort offers into buckets according to state. Do this every time a new offers is received for the user
$: {
    // If we got a new offer, push it into the collection and start listening to ticket of that
    // OR we got a new ticket that we are interested in with these offers. Check its '#a' tag to set offer status 
    if ($myOffers && $ticketsOfSpecificOffers) {
        pendingOffers = [];
        wonOffers = [];
        lostOffers = [];

        $myOffers.forEach((offer: OfferEvent) => {
            // This approach does not display an offer until it has successfully 
            // retrieved its status from its ticket!
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
        });
        filterOffersByTicket();
    } else {
        console.log('My offers is null or size equals 0!')
    }
}

</script>

{#if $currentUser}
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
                    {#each filteredPendingOffers as offer }
                        <div class="flex justify-center">
                            <OfferCard {offer} countAllOffers={true} enableChat={true}/>
                        </div>
                    {/each}
                </div>
            {:else if tabGroup === 1}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each filteredWonOffers as offer }
                        <div class="flex justify-center">
                            <OfferCard {offer} countAllOffers={true} enableChat={true}/>
                        </div>
                    {/each}
                </div>
            {:else if tabGroup === 2}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each filteredLostOffers as offer }
                        <div class="flex justify-center">
                            <OfferCard {offer} countAllOffers={true} enableChat={true}/>
                        </div>
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Offers!</h2>
{/if}
<!-- Search bar -->
<div class="fixed bottom-20 right-4 flex items-center gap-x-2">
    <div class="{hideSearch ? 'hidden' : ''}">
        <!-- On some devices a little 'x' icon clears the input, triggering on:search event -->
        <input
            class="input"
            type="search"
            placeholder="Filter by title, descr. and tags..."
            bind:value={filterInput}
            on:keyup={filterOffersByTicket}
            on:search={filterOffersByTicket}
        />
    </div>
    <button class="btn btn-icon bg-primary-300-600-token"
        on:click={()=> {
            hideSearch = !hideSearch;
            filterInput = '';
            filterOffersByTicket();
        }}
    >
        <span class="">
            <i class="fa-solid fa-magnifying-glass text-lg"></i>
        </span>
    </button>
</div>
