<script lang="ts">
import currentUser from "$lib/stores/user";

import type { NDKTag } from '@nostr-dev-kit/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';
import { ticketTabStore } from "$lib/stores/tab-store";

import { TicketStatus, TicketEvent } from '$lib/events/TicketEvent';
import { myTickets } from '$lib/stores/troubleshoot-eventstores';
import TicketCard from '$lib/components/OrderBook/TicketCard.svelte';
import SearchIcon from "$lib/components/Icons/SearchIcon.svelte";


let newTickets: TicketEvent[] = [];
let inProgressTickets: TicketEvent[] = [];
let closedTickets: TicketEvent[] = [];

let filterInput = '';
let showNewTicket: Array<boolean> = [];
let showInProgressTicket: Array<boolean> = [];
let showClosedTicket: Array<boolean> = [];

let hideSearch = true;

function filterTickets() {
    showNewTicket = [];
    for (let i = 0; i < newTickets.length; i++) {
        const lowerCaseFilter = filterInput.toLowerCase();

        const lowerCaseTitle = newTickets[i].title.toLowerCase();
        const lowerCaseDescription = newTickets[i].description.toLowerCase();

        let tagsContain = false;
        newTickets[i].tags.forEach((tag: NDKTag) => {
            if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                tagsContain = true;
            }
        });

        const titleContains = lowerCaseTitle.includes(lowerCaseFilter);
        const descContains = lowerCaseDescription.includes(lowerCaseFilter);

        if (titleContains || descContains || tagsContain) {
            showNewTicket.push(true);
        } else {
            showNewTicket.push(false);
        }
    }
    newTickets = newTickets;

    showInProgressTicket = [];
    for (let i = 0; i < inProgressTickets.length; i++) {
        const lowerCaseFilter = filterInput.toLowerCase();

        const lowerCaseTitle = inProgressTickets[i].title.toLowerCase();
        const lowerCaseDescription = inProgressTickets[i].description.toLowerCase();

        let tagsContain = false;
        inProgressTickets[i].tags.forEach((tag: NDKTag) => {
            if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                tagsContain = true;
            }
        });

        const titleContains = lowerCaseTitle.includes(lowerCaseFilter);
        const descContains = lowerCaseDescription.includes(lowerCaseFilter);

        if (titleContains || descContains || tagsContain) {
            showInProgressTicket.push(true);
        } else {
            showInProgressTicket.push(false);
        }
    }
    inProgressTickets = inProgressTickets;

    showClosedTicket = [];
    for (let i = 0; i < closedTickets.length; i++) {
        const lowerCaseFilter = filterInput.toLowerCase();

        const lowerCaseTitle = closedTickets[i].title.toLowerCase();
        const lowerCaseDescription = closedTickets[i].description.toLowerCase();

        let tagsContain = false;
        closedTickets[i].tags.forEach((tag: NDKTag) => {
            if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                tagsContain = true;
            }
        });

        const titleContains = lowerCaseTitle.includes(lowerCaseFilter);
        const descContains = lowerCaseDescription.includes(lowerCaseFilter);

        if (titleContains || descContains || tagsContain) {
            showClosedTicket.push(true);
        } else {
            showClosedTicket.push(false);
        }
    }
    closedTickets = closedTickets;
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
            } else if (ticket.isClosed()) {
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
        <Tab bind:group={$ticketTabStore} name="tab1" value={TicketStatus.New}>
            New
        </Tab>
        <Tab bind:group={$ticketTabStore} name="tab2" value={TicketStatus.InProgress}>
            In Progress
        </Tab>
        <Tab bind:group={$ticketTabStore} name="tab3" value={TicketStatus.Resolved}>
            Closed
        </Tab>
        <!-- Tab Panels --->
        <svelte:fragment slot="panel">
            {#if $ticketTabStore === TicketStatus.New}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each newTickets as ticket, i (ticket.id)}
                        <div class="flex justify-center {showNewTicket[i] ? '' : 'hidden'}">
                            <TicketCard {ticket} countAllOffers={true} titleSize={'md md:text-xl'}/>
                        </div>
                    {/each}
                </div>
                {:else if $ticketTabStore === TicketStatus.InProgress}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each inProgressTickets as ticket, i (ticket.id)}
                        <div class="flex justify-center {showInProgressTicket[i] ? '' : 'hidden'}">
                            <TicketCard {ticket} countAllOffers={true} titleSize={'md md:text-xl'}/>
                        </div>
                    {/each}
                </div>
                {:else if $ticketTabStore === TicketStatus.Resolved}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each closedTickets as ticket, i (ticket.id)}
                        <div class="flex justify-center {showClosedTicket[i] ? '' : 'hidden'}">
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
        }}
    >
        <SearchIcon />
    </button>
</div>
