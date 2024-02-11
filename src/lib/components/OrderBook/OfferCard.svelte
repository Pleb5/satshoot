<script lang="ts">
    import { OfferEvent, Pricing } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import type { NDKEvent } from "@nostr-dev-kit/ndk";
    import { onMount } from "svelte";
    import ndk from "$lib/stores/ndk";
    import { NDKRelaySet } from "@nostr-dev-kit/ndk";

    import { nip19 } from "nostr-tools";
    import { BTCTroubleshootKind } from "$lib/events/kinds";
    import TicketCard from "./TicketCard.svelte";
    
    export let offer: OfferEvent;
    let ticket: TicketEvent | null;
    const bech32ID: string = nip19.naddrEncode({
        kind: BTCTroubleshootKind.Ticket,
        pubkey: offer.referencedTicketAddress?.split(':')[1] as string,
        identifier: offer.referencedTicketAddress?.split(':')[2] as string,
    });

    let ticketPromise: Promise<NDKEvent> | null = null;

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
            ticketPromise = $ndk.fetchEvent(bech32ID, {}, new NDKRelaySet(new Set($ndk.pool.relays.values()), $ndk)) as Promise<TicketEvent> | null; 
            let event = await ticketPromise;
            if (event) {
                ticket = TicketEvent.from(event);
            }
        }

    });

</script>

<div class="card">
    {#if offer}
        {#if ticket}
            <TicketCard {ticket} >
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
