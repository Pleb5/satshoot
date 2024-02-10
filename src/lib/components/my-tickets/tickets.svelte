<script lang="ts">
import ndk from '$lib/stores/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { TicketStatus, type TicketEvent } from '$lib/events/TicketEvent';
import { myTickets } from '$lib/stores/troubleshoot-eventstores';
import TicketCard from '../OrderBook/TicketCard.svelte';

let tabGroup = TicketStatus.New;

const ticketMap: Map<TicketStatus, TicketEvent[]> = new Map();
let newTicketsArray: TicketEvent[] = [];
let inProgressTicketsArray: TicketEvent[] = [];
let closedTicketsArray: TicketEvent[] = [];

ticketMap.set(TicketStatus.New, newTicketsArray);
ticketMap.set(TicketStatus.InProgress, inProgressTicketsArray);
ticketMap.set(TicketStatus.Closed, closedTicketsArray);

// Sort tickets into buckets according to state. Do this every time a new ticket is received for the user
$: {
    if ($myTickets) {
        $myTickets.forEach((ticket: TicketEvent) => {
            let ticketArray = ticketMap.get(ticket.status as TicketStatus) as TicketEvent[];
            let found = false;
            ticketArray.forEach((sortedTicket: TicketEvent) => {
                if (sortedTicket.ticketAddress === ticket.ticketAddress) {
                    found = true;
                }
            });
            if (!found) {
                ticketArray.push(ticket);
                console.log('new unique ticket, adding to myTickets...')
                newTicketsArray = newTicketsArray;
                inProgressTicketsArray = inProgressTicketsArray;
                closedTicketsArray = closedTicketsArray;
            }
            console.log('newTicketsArray', newTicketsArray)
        });


        console.log('my tickets:', $myTickets)
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
                <div class="flex flex-col justify-center center gap-y-4">
                    {#each newTicketsArray as ticket }
                        <TicketCard {ticket} />
                    {/each}
                </div>
                {:else if tabGroup === 1}
                <div>
                    {#each inProgressTicketsArray as ticket }
                        <TicketCard {ticket} />
                    {/each}
                </div>
                {:else if tabGroup === 2}
                <div>
                    {#each closedTicketsArray as ticket }
                        <TicketCard {ticket} />
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Tickets!</h2>
{/if}
