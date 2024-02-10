<script lang="ts">
    import { tickets } from "$lib/stores/troubleshoot-eventstores";
    import TicketCard from "./TicketCard.svelte";
    
</script>

<div class="flex flex-col justify-center items-center gap-y-4 ">
    {#if $tickets}
        {#each $tickets as ticket}

            <TicketCard {ticket}/>

        {/each}
    {/if}
</div>

<!-- Take a look at more options for tailwindcss in skeleton (cards etc) -->
<!-- Make sure theme is applied, use variant colors -->

