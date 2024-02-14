<script lang="ts">
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import type { TicketEvent, } from "$lib/events/TicketEvent";
    import { offersOnTickets } from "$lib/stores/troubleshoot-eventstores";
    
    export let ticket: TicketEvent | null = null;
    export let titleSize: string = 'md';
    export let titleLink: boolean = true;
    export let countAllOffers: boolean = false;

    const bech32ID = ticket?.encode();

    let offers: OfferEvent[] = [];
    let offerCount: string = '?';
    let offersAlreadyColor: string = 'text-primary-300-600-token';

    $: {
        console.log('in ticket card reactive block ')
        if (ticket && countAllOffers) {
            console.log('start offer sub for offercount in ticket card')

            offers = [];
            $offersOnTickets.forEach((offer: OfferEvent) => {
                if (offer.referencedTicketAddress === ticket?.ticketAddress) {
                    offers.push(offer);
                }
                
            });

            offerCount = offers.length.toString();
            if (offers.length > 0) {
                offersAlreadyColor = 'text-error-300-600-token';
            }
            console.log('offer count: ', offerCount)
        }
    }

</script>


<div class="card">
    {#if ticket}
        <header class="card-header">
            {#if titleLink}
                <a class="anchor text-{titleSize}" href={"/" + bech32ID }>{ticket.title ?? 'No title'}</a>
            {:else}
                <div class="text-{titleSize}">
                    {ticket.title ?? 'No title'}
                </div>
            {/if}
        </header>

        <section class="p-4">
            <div class=" grid grid-cols-5 gap-x-2">
                <div class="col-span-4">
                    { 
                    ticket.description 
                        ? ticket.description.length > 80 ? ticket.description.substring(0, 80) + "..." : ticket.description
                        : 'No description!'
                    }
                </div>
                <slot name="button"/>
            </div>

        <slot name='myOffer' />
        {#if countAllOffers}
                <div 
                    class="text-sm font-bold {offersAlreadyColor} mt-2"
                >
                    {'Offers on ticket: ' + offerCount}
                </div>
        {/if}
        </section>
        <footer class="items-center flex flex-wrap card-footer">
            {#each ticket.tTags as tag }
                <div class="px-2 rounded-token">
                    <span class="badge variant-filled-surface">{ tag[1] }</span>
                </div>
            {/each}
        </footer>
    {:else}
        <h2 class="text-center font-bold mt-10" >Loading Ticket...</h2>
    {/if}
</div>

