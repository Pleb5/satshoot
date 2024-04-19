<script lang="ts">
import currentUser from "$lib/stores/login";

import type { NDKTag } from '@nostr-dev-kit/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { TicketStatus, TicketEvent } from '$lib/events/TicketEvent';
import { myTickets } from '$lib/stores/troubleshoot-eventstores';
import TicketCard from '../OrderBook/TicketCard.svelte';


let tabGroup = TicketStatus.New;

let newTickets: TicketEvent[] = [];
let inProgressTickets: TicketEvent[] = [];
let closedTickets: TicketEvent[] = [];

let filterInput = '';
let filteredNewTickets: TicketEvent[] = [];
let filteredInProgressTickets: TicketEvent[] = [];
let filteredClosedTickets: TicketEvent[] = [];

let hideSearch = true;

function filterTickets() {
    filteredNewTickets = newTickets.filter((t: TicketEvent) => {
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
            return true;
        }
        return false;
    });

    filteredInProgressTickets = inProgressTickets.filter((t: TicketEvent) => {
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
            return true;
        }
        return false;
    });

    filteredClosedTickets = closedTickets.filter((t: TicketEvent) => {
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
            return true;
        }
        return false;
    });
}

// Sort tickets into buckets according to state. Do this every time a new ticket is received for the user
$: {
    if ($myTickets) {
        newTickets = [];
        inProgressTickets = [];
        closedTickets = [];

        $myTickets.forEach((ticket: TicketEvent) => {
            if (ticket.status === TicketStatus.New) {
                newTickets.push(ticket);
            } else if (ticket.status === TicketStatus.InProgress) {
                inProgressTickets.push(ticket);
            } else if (ticket.status === TicketStatus.Closed) {
                closedTickets.push(ticket);
            }
        });
        filterTickets();
    } else {
        console.log('My tickets is null!')
    }
}

</script>

{#if $currentUser}
    <TabGroup justify='justify-evenly' flex='flex-grow'>
        <Tab bind:group={tabGroup} name="tab1" value={TicketStatus.New}>
            New
        </Tab>
        <Tab bind:group={tabGroup} name="tab2" value={TicketStatus.InProgress}>
            In Progress
        </Tab>
        <Tab bind:group={tabGroup} name="tab2" value={TicketStatus.Closed}>
            Closed
        </Tab>
        <!-- Tab Panels --->
        <svelte:fragment slot="panel">
            {#if tabGroup === 0}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each filteredNewTickets as ticket }
                        <div class="flex justify-center">
                            <TicketCard {ticket} countAllOffers={true} titleSize={'md md:text-xl'}/>
                        </div>
                    {/each}
                </div>
                {:else if tabGroup === 1}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each filteredInProgressTickets as ticket }
                        <div class="flex justify-center">
                            <TicketCard {ticket} countAllOffers={true} titleSize={'md md:text-xl'}/>
                        </div>
                    {/each}
                </div>
                {:else if tabGroup === 2}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each filteredClosedTickets as ticket }
                        <div class="flex justify-center">
                            <TicketCard {ticket} countAllOffers={true} titleSize={'md md:text-xl'}/>
                        </div>
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Tickets!</h2>
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
            on:keyup={filterTickets}
            on:search={filterTickets}
        />
    </div>
    <button class="btn btn-icon bg-primary-300-600-token"
        on:click={()=> {
            hideSearch = !hideSearch;
            filterInput = '';
            filterTickets();
        }}
    >
        <span class="">
            <i class="fa-solid fa-magnifying-glass text-lg"></i>
        </span>
    </button>
</div>
