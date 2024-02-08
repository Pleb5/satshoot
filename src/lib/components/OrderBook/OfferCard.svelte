<script lang="ts">
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import type { TicketEvent } from "$lib/events/TicketEvent";
    import { onMount } from "svelte";
    import ndk from "$lib/stores/ndk";
    import { NDKRelaySet } from "@nostr-dev-kit/ndk";

    import { nip19 } from "nostr-tools";
    import { BTCTroubleshootKind } from "$lib/events/kinds";
    
    export let offer: OfferEvent;
    let ticket: TicketEvent;
    const bech32ID: string = nip19.naddrEncode({
        kind: BTCTroubleshootKind.Ticket,
        pubkey: offer.referencedTicketAddress?.split(':')[1] as string,
        identifier: offer.referencedTicketAddress?.split(':')[2] as string,
    });

    let ticketPromise: Promise<TicketEvent> | null = null;

    onMount(async() => {

        if (offer) {
            ticketPromise = $ndk.fetchEvent(bech32ID, {}, new NDKRelaySet(new Set($ndk.pool.relays.values()), $ndk)) as Promise<TicketEvent> | null; 
            await ticketPromise;
        }

    });

</script>

{#if offer}

    {#await ticketPromise then ticket}
        {#if ticket}
            <div class="card">
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
            </div>
        {:else}
            <h2 class="h2 text-center text-error-500">Error: Ticket for Offer not found!</h2>
        {/if}
    {/await}

{:else}
    <h2 class="h2 text-center text-error-500">Error: Offer not found!</h2>
{/if}
