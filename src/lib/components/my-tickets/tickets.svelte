<script lang="ts">
import ndk from '$lib/stores/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { TicketStatus, type TicketEvent } from '$lib/events/TicketEvent';
import { myTickets } from '$lib/stores/troubleshoot-eventstores';
import TicketCard from '../OrderBook/TicketCard.svelte';

let tabGroup = TicketStatus.New;

const ticketMap: Map<TicketStatus, Set<TicketEvent>> = new Map();
let newTicketSet: Set<TicketEvent> = new Set();
let inProgressTicketSet: Set<TicketEvent> = new Set();
let closedTicketSet: Set<TicketEvent> = new Set();

ticketMap.set(TicketStatus.New, newTicketSet);
ticketMap.set(TicketStatus.InProgress, inProgressTicketSet);
ticketMap.set(TicketStatus.Closed, closedTicketSet);

// Sort tickets into buckets according to state. Do this every time a new ticket is received for the user
$: {
    if ($myTickets && $myTickets.length > 0) {
        // Search newest ticket using  
        $myTickets.forEach((ticket: TicketEvent) => {
            // If ticket has valid status
            if (ticket.status === TicketStatus.New || 
                ticket.status === TicketStatus.InProgress || 
                ticket.status === TicketStatus.Closed) {

                console.log('valid ticket, trying add to myTickets...')

                let ticketSet = ticketMap.get(ticket.status);
                if (!(ticketSet?.has(ticket)) ) {
                    console.log('NEW valid ticket found. Adding to set, starting ticket sub')
                    ticketSet?.add(ticket);
                }

                console.log('my offers:', $myTickets)
                console.log('new tickets:', newTicketSet)
            }
            newTicketSet = newTicketSet;
            inProgressTicketSet = inProgressTicketSet;
            closedTicketSet = closedTicketSet;
        });

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
                <div class="grid grid-cols-1 itesm-center center gap-y-4 mx-8">
                    {#each newTicketSet as ticket }
                        <TicketCard {ticket} countAllOffers={true}/>
                    {/each}
                </div>
                {:else if tabGroup === 1}
                <div>
                    {#each inProgressTicketSet as ticket }
                        <TicketCard {ticket} countAllOffers={true}/>
                    {/each}
                </div>
                {:else if tabGroup === 2}
                <div>
                    {#each closedTicketSet as ticket }
                        <TicketCard {ticket} countAllOffers={true}/>
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Tickets!</h2>
{/if}
