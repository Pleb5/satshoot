<script lang="ts">
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketStatus, type TicketEvent, } from "$lib/events/TicketEvent";
    import { offersOnTickets } from "$lib/stores/troubleshoot-eventstores";

    import { nip19 } from "nostr-tools";
    
    export let ticket: TicketEvent | null = null;
    export let titleSize: string = 'md';
    export let titleLink: boolean = true;
    export let countAllOffers: boolean = false;

    const bech32ID = ticket?.encode();
    let npub: string;
    let timeSincePosted: string; 
    let ticketStatus: string;

    let offers: OfferEvent[] = [];
    let offerCount: string = '?';
    let offersAlreadyColor: string = 'text-primary-300-600-token';

    $: {
        if (ticket) {
            npub = nip19.npubEncode(ticket.pubkey);

            if (ticket.created_at) {
                // Created_at is in Unix time seconds
                let seconds = Math.floor(Date.now() / 1000 - ticket.created_at);
                let minutes = Math.floor(seconds / 60);
                let hours = Math.floor(minutes / 60);
                let days = Math.floor(hours / 24);
                if (days >= 1) {
                    timeSincePosted = days.toString() + ' day(s) ago';
                } else if(hours >= 1) {
                    timeSincePosted = hours.toString() + ' hour(s) ago';
                } else if(minutes >= 1) {
                    timeSincePosted = minutes.toString() + ' minute(s) ago';
                } else if(seconds >= 20) {
                    timeSincePosted = seconds.toString() + ' second(s) ago';
                } else {
                    timeSincePosted = 'just now';
                }
            }

            if (ticket.status >= 0) {
                if (ticket.status === TicketStatus.New) {
                    ticketStatus = 'New';
                } else if (ticket.status === TicketStatus.InProgress) {
                    ticketStatus = 'In Progress';
                } else if (ticket.status === TicketStatus.Closed) {
                    ticketStatus = 'Closed';
                }
            }

            if (countAllOffers) {

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

            <hr class="my-4" />

            <div class="">
                <span class="pr-1">Status: </span>
                <span class="text-primary-300-600-token font-bold">{ticketStatus}</span>
            </div>
            <div class="">
                <span class="">Posted by: </span>
                <span>
                    <a class="anchor" href={'/' + npub}>{npub.slice(0, 10) + '...'}</a>
                </span>
            </div>
            <div class="">{timeSincePosted}</div>
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
                <div class="pr-4 rounded-token">
                    <span class="badge variant-filled-surface">{ tag[1] }</span>
                </div>
            {/each}
        </footer>
    {:else}
        <h2 class="text-center font-bold mt-10" >Loading Ticket...</h2>
    {/if}
</div>

