<script lang="ts">
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import { NDKEvent } from "@nostr-dev-kit/ndk";
    import { onMount } from "svelte";
    import ndk from "$lib/stores/ndk";
    import { NDKRelaySet } from "@nostr-dev-kit/ndk";

    import { nip19 } from "nostr-tools";
    import { BTCTroubleshootKind } from "$lib/events/kinds";
    
    export let offer: OfferEvent;
    let ticket: TicketEvent | null;
    const bech32ID: string = nip19.naddrEncode({
        kind: BTCTroubleshootKind.Ticket,
        pubkey: offer.referencedTicketAddress?.split(':')[1] as string,
        identifier: offer.referencedTicketAddress?.split(':')[2] as string,
    });

    let ticketPromise: Promise<NDKEvent> | null = null;

    onMount(async() => {

        if (offer) {
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
            <header class="card-header">
                <a class="anchor" href={"/" + bech32ID }>{ticket.title ?? 'No title'}</a>
            </header>

            <!-- TODO: truncate to shorter text. figure out how many chars looks good -->
            <section class="p-4">
                { 
                ticket.description 
                    ? ticket.description.length > 80 ? ticket.description.substring(0, 80) + "..." : ticket.description
                    : 'No description!'
                }
            </section>
            <footer class="items-center flex flex-wrap card-footer">
                {#each ticket.tTags as tag }
                    <div class="px-2 rounded-token">
                        <span class="badge variant-filled-surface">{ tag[1] }</span>
                    </div>
                {/each}
            </footer>
        {:else}
            <h2 class="h2 text-center text-error-500">Loading Ticket for Offer...</h2>
        {/if}

    {:else}
        <h2 class="h2 text-center text-error-500">Error: Offer not found!</h2>
    {/if}
</div>
