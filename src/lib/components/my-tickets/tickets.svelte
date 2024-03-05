<script lang="ts">
import ndk from '$lib/stores/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { TicketStatus, TicketEvent } from '$lib/events/TicketEvent';
import { myTickets } from '$lib/stores/troubleshoot-eventstores';
import { offersOnTickets, offersOnTicketsFilter } from "$lib/stores/troubleshoot-eventstores";
import TicketCard from '../OrderBook/TicketCard.svelte';


let tabGroup = TicketStatus.New;

const ticketMap: Map<TicketStatus, TicketEvent[]> = new Map();
let newTickets: TicketEvent[] = [];
let inProgressTickets: TicketEvent[] = [];
let closedTickets: TicketEvent[] = [];

ticketMap.set(TicketStatus.New, newTickets);
ticketMap.set(TicketStatus.InProgress, inProgressTickets);
ticketMap.set(TicketStatus.Closed, closedTickets);

// Sort tickets into buckets according to state. Do this every time a new ticket is received for the user
$: {
    if ($myTickets) {
        console.log('my tickets is defined, sort it by status...', $myTickets)
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
            const aTagFilters = offersOnTicketsFilter['#a'];
            if (!aTagFilters?.includes(ticket.ticketAddress)) {
                offersOnTicketsFilter['#a']?.push(ticket.ticketAddress);
            }
        });
        /// Set filter, restart offer sub.
        offersOnTickets.unsubscribe();
        console.log(' unsubbed from offersOnTickets')
        // offersOnTickets = $ndk.storeSubscribe(offersOnTicketsFilter, subOptions, OfferEvent);
        offersOnTickets.startSubscription();
        console.log('restarted sub offersOnTickets')
        console.log(offersOnTickets)


        // UI update
        newTickets = newTickets;
        inProgressTickets = inProgressTickets;
        closedTickets = closedTickets;
    } else {
        console.log('My tickets is null!')
    }
}

</script>

{#if $ndk.activeUser}
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
                    {#each newTickets as ticket }
                        <TicketCard {ticket} countAllOffers={true} titleSize={'md md:text-xl'}/>
                    {/each}
                </div>
                {:else if tabGroup === 1}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each inProgressTickets as ticket }
                        <TicketCard {ticket} countAllOffers={true}/>
                    {/each}
                </div>
                {:else if tabGroup === 2}
                <div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
                    {#each closedTickets as ticket }
                        <TicketCard {ticket} countAllOffers={true}/>
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Tickets!</h2>
{/if}
