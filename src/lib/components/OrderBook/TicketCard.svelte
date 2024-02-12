<script lang="ts">
    import type { TicketEvent } from "$lib/events/TicketEvent";
    
    export let ticket: TicketEvent | undefined = undefined;
    export let titleSize: string = 'md';
    export let titleLink: boolean = true;
    const bech32ID = ticket?.encode();

    let offerCount: number = 0;
    let offersAlreadyColor: string = 'text-primary-300-600-token';

    $: {
        if (ticket) {
            offerCount = ticket.offersOnTicket.size;
            if (offerCount > 0) {
                offersAlreadyColor = 'text-error-500';
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

        <slot name='myOffer' />

        <div 
            class="text-sm font-bold {offersAlreadyColor} mt-2"
        >
            {'Offers on ticket: ' + offerCount}
        </div>
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

