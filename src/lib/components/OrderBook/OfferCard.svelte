<script lang="ts">
    import { OfferEvent, Pricing } from "$lib/events/OfferEvent";
    import { onMount } from "svelte";

    import TicketCard from "./TicketCard.svelte";
    
    export let offer: OfferEvent;

    let pricing: string = '';

    onMount(async() => {

        if (offer) {
            switch (offer.pricing) {
                case Pricing.Absolute:
                    pricing = 'sats';
                    break;
                case Pricing.SatsPerMin:
                    pricing = 'sats/min';
                    break;
            }
        }

    });

    $: {
        if (offer.ticket) {
            offer.ticket = offer.ticket;
        }
    }

</script>

<div class="card">
    {#if offer}
        {#if offer.ticket}
            <TicketCard ticket={offer.ticket} >
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
