<script lang="ts">
    import { OfferEvent, Pricing } from "$lib/events/OfferEvent";

    import TicketCard from "./TicketCard.svelte";
    import type { TicketEvent } from "$lib/events/TicketEvent";

    import { offersOnTickets, offersOnTicketsFilter, ticketsOfMyOffers } from "$lib/stores/troubleshoot-eventstores";
    
    export let offer: OfferEvent | null = null;
    export let countAllOffers: boolean = false;
    export let showTicket: boolean = true;
    let ticket: TicketEvent | undefined = undefined;

    let pricing: string = '';

    $: {
        if (offer) {
            switch (offer.pricing) {
                case Pricing.Absolute:
                    pricing = 'sats';
                    break;
                case Pricing.SatsPerMin:
                    pricing = 'sats/min';
                    break;
            }

            if (showTicket) {
                console.log('offer is defined, lets set ticket...')
                console.log('tickets of my offers:', $ticketsOfMyOffers)
                if (!ticket) {
                    $ticketsOfMyOffers.forEach((t: TicketEvent) => {
                        if (t.ticketAddress === offer?.referencedTicketAddress) {
                            ticket = t;
                            console.log('ticket', ticket)
                            const aTagFilters = offersOnTicketsFilter['#a'];
                            if (!aTagFilters?.includes(ticket?.ticketAddress)) {
                                offersOnTicketsFilter['#a']?.push(ticket.ticketAddress);
                                offersOnTickets.unsubscribe();
                                offersOnTickets.startSubscription();
                            }
                        }
                    });
                }
            }
        } else {
            console.log('offer is null yet!')
        }

    }

</script>

<div class="card">
    {#if offer}
        <h3 class="h3 text-center text-primary-300-600-token">
            {'Offer: ' + offer.amount + ' ' + pricing} 
        </h3>
        {#if showTicket}
            <h4 class="h4 text-center text-primary-300-600-token"> On Ticket:</h4>
            {#if ticket}
                <TicketCard ticket={ticket} {countAllOffers} >
                    <div slot="myOffer" class="text-primary-300-600-token mt-2">

                    </div>
                </TicketCard>
            {:else}
                <h2 class="h2 text-center text-error-500">Loading Ticket for Offer...</h2>
            {/if}
        {/if}
    {:else}
        <h2 class="h2 text-center text-error-500">Error: Offer not found!</h2>
    {/if}
</div>
