<script lang="ts">
    import { InputChip } from "@skeletonlabs/skeleton";
    import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";
    import pageTitleStore from "$lib/stores/pagetitle-store";
    import { newTickets } from "$lib/stores/troubleshoot-eventstores";

    let list: string[] = ['foo', 'bar', 'fizz', 'buzz'];

    $pageTitleStore = 'BTC Troubleshoot';

    $: if($newTickets) {
        console.log('newtickets:', $newTickets)
        $newTickets = $newTickets;
    }

</script>

<a href="/post-ticket" class="btn fixed bottom-20 right-10 xl:btn-xl lg:btn-lg md:btn-md bg-primary-300-600-token">
    <span>Get Help</span>
</a>


<div class="flex flex-col justify-center gap-y-2 mt-2">
    <div class="sticky top-0 mx-auto flex items-center justify-center bg-surface-100-800-token">
        <InputChip bind:value={list} name="chips" placeholder="Filter Tickets" />
    </div>

    <div class="grid grid-cols-1 itesm-center center gap-y-4 mx-8 mb-8">
        {#if $newTickets}
            {#each $newTickets as ticket}

                <TicketCard {ticket}/>

            {/each}
        {/if}
    </div>
</div>
