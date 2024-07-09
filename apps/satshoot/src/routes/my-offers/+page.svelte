
<script lang="ts">
import currentUser from "$lib/stores/user";

import type { NDKTag } from '@nostr-dev-kit/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';
import { offerTabStore } from "$lib/stores/tab-store";

import { OfferStatus, type OfferEvent } from '$lib/events/OfferEvent';
import { allTickets, myOffers } from '$lib/stores/troubleshoot-eventstores';
import OfferCard from '$lib/components/OrderBook/OfferCard.svelte';
import { type TicketEvent } from '$lib/events/TicketEvent';
import SearchIcon from "$lib/components/Icons/SearchIcon.svelte"; 

let pendingOffers: OfferEvent[] = [];
let wonOffers: OfferEvent[] = [];
let lostOffers: OfferEvent[] = [];

let filterInput = '';
let showPendingOffer: Array<boolean> = [];
let showWonOffer: Array<boolean> = [];
let showLostOffer: Array<boolean> = [];

let hideSearch = true;

function filterOffersByTicket() {
    showPendingOffer = [];
    for (let i = 0; i < pendingOffers.length; i++) {
        const ticket: TicketEvent|undefined = $allTickets.find((t: TicketEvent) => 
            t.ticketAddress === pendingOffers[i].referencedTicketAddress
        );

        if (!ticket) continue;

        const lowerCaseFilter = filterInput.toLowerCase();

        const lowerCaseTitle = ticket.title.toLowerCase();
        const lowerCaseDescription = ticket.description.toLowerCase();

        let tagsContain = false;
        ticket.tags.forEach((tag: NDKTag) => {
            if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                tagsContain = true;
            }
        });

        const titleContains = lowerCaseTitle.includes(lowerCaseFilter);
        const descContains = lowerCaseDescription.includes(lowerCaseFilter);

        if (titleContains || descContains || tagsContain) {
            showPendingOffer.push(true);
        } else {
            showPendingOffer.push(false);
        }
    }
    pendingOffers = pendingOffers;

    showWonOffer = [];
    for (let i = 0; i < wonOffers.length; i++) {
        const ticket: TicketEvent|undefined = $allTickets.find((t: TicketEvent) => 
            t.ticketAddress === wonOffers[i].referencedTicketAddress
        );

        if (!ticket) continue;

        const lowerCaseFilter = filterInput.toLowerCase();

        const lowerCaseTitle = ticket.title.toLowerCase();
        const lowerCaseDescription = ticket.description.toLowerCase();

        let tagsContain: boolean = false;
        ticket.tags.forEach((tag: NDKTag) => {
            if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                tagsContain = true;
            }
        });

        const titleContains: boolean = lowerCaseTitle.includes(lowerCaseFilter);
        const descContains: boolean = lowerCaseDescription.includes(lowerCaseFilter);

        if (titleContains || descContains || tagsContain) {
            showWonOffer.push(true);
        } else {
            showWonOffer.push(false);
        }
    }
    wonOffers = wonOffers;

    showLostOffer = [];
    for (let i = 0; i < lostOffers.length; i++) {
        const ticket: TicketEvent|undefined = $allTickets.find((t: TicketEvent) => 
            t.ticketAddress === lostOffers[i].referencedTicketAddress
        );

        if (!ticket) continue;

        const lowerCaseFilter = filterInput.toLowerCase();

        const lowerCaseTitle = ticket.title.toLowerCase();
        const lowerCaseDescription = ticket.description.toLowerCase();

        let tagsContain: boolean = false;
        ticket.tags.forEach((tag: NDKTag) => {
            if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                tagsContain = true;
            }
        });

        const titleContains: boolean = lowerCaseTitle.includes(lowerCaseFilter);
        const descContains: boolean = lowerCaseDescription.includes(lowerCaseFilter);

        if (titleContains || descContains || tagsContain) {
            showLostOffer.push(true);
        } else {
            showLostOffer.push(false);
        }
    }
    lostOffers = lostOffers;
}

// Sort offers into buckets according to state
// Do this every time a new offer is received for the user
$: {
    // If we got a new offer, push it into the collection 
    if ($myOffers && $allTickets) {
        pendingOffers = [];
        wonOffers = [];
        lostOffers = [];

        $myOffers.forEach((offer: OfferEvent) => {
            // This approach does not display an offer until it has successfully 
            // retrieved its status from its ticket!
            $allTickets.forEach((ticket:TicketEvent) => {
                if (ticket.ticketAddress === offer.referencedTicketAddress) {
                    if (ticket.acceptedOfferAddress === offer.offerAddress) {
                        wonOffers.push(offer);
                    } else if (ticket.acceptedOfferAddress
                            || ticket.isClosed()
                    ) {
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
        <Tab
            bind:group={$offerTabStore}
            name="offerTab1"
            value={OfferStatus.Pending}

        >
            Pending
        </Tab>
        <Tab
            bind:group={$offerTabStore}
            name="offerTab2"
            value={OfferStatus.Won}
        >
            Won
        </Tab>
        <Tab
            bind:group={$offerTabStore}
            name="offerTab3"
            value={OfferStatus.Lost}
        >
            Lost
        </Tab>
        <!-- Tab Panels --->
        <svelte:fragment slot="panel">
            {#if $offerTabStore === OfferStatus.Pending}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each pendingOffers as offer, i (offer.id) }
                        <div class="flex justify-center {showPendingOffer[i] ? '' : 'hidden'}">
                            <OfferCard
                                {offer}
                                countAllOffers={true}
                                enableChat={true}
                            >
                            </OfferCard>
                        </div>
                    {/each}
                </div>
            {:else if $offerTabStore === OfferStatus.Won}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each wonOffers as offer, i (offer.id) }
                        <div class="flex justify-center {showWonOffer[i] ? '' : 'hidden'}">
                            <OfferCard {offer} countAllOffers={true} enableChat={true}/>
                        </div>
                    {/each}
                </div>
            {:else if $offerTabStore === OfferStatus.Lost}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each lostOffers as offer, i (offer.id) }
                        <div class="flex justify-center {showLostOffer[i] ? '' : 'hidden'}">
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
        }}
    >
        <SearchIcon />
    </button>
</div>
