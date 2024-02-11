<script lang="ts">
    import { tickets } from "$lib/stores/troubleshoot-eventstores";
    import TicketCard from "./TicketCard.svelte";

    // TODO: Orderbook is unnecessary
    // tickets lose offercount state on back page navigation

</script>

<div class="grid grid-cols-1 itesm-center center gap-y-4 mx-8">
    {#if $tickets}
        {#each $tickets as ticket}

            <TicketCard {ticket}/>

        {/each}
    {/if}
</div>

<!-- Take a look at more options for tailwindcss in skeleton (cards etc) -->
<!-- Make sure theme is applied, use variant colors -->

