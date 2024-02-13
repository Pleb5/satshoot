<script lang="ts">
    import { OfferEvent, Pricing } from "$lib/events/OfferEvent";

    import TicketCard from "./TicketCard.svelte";
    import type { TicketEvent } from "$lib/events/TicketEvent";
    
    export let offer: OfferEvent | null = null;
    let ticket: TicketEvent | null = null;

    let pricing: string = '';

    $: {
        if (offer) {
            console.log('offer is defined, lets set ticket...')
            if (offer.ticket) {
                ticket = offer.ticket;
            }
            switch (offer.pricing) {
                case Pricing.Absolute:
                    pricing = 'sats';
                    break;
                case Pricing.SatsPerMin:
                    pricing = 'sats/min';
                    break;
            }
        } else {
            console.log('offer is null yet!')
        }

    }

</script>

<div class="card">
    {#if offer}
        {#if ticket}
            <TicketCard ticket={ticket} >
                <div slot="myOffer" class="text-primary-300-600-token mt-2">
                    {'My Offer: ' + offer.amount + ' ' + pricing}
                </div>
            </TicketCard>
        {:else}
            <h2 class="h2 text-center text-error-500">Loading Ticket for Offer...</h2>
        {/if}

    {:else}
        <h2 class="h2 text-center text-error-500">Error: Offer not found!</h2>
    {/if}
</div>
