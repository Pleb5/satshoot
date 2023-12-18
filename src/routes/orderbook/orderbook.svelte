<script lang="ts">
    import TicketCard from "./ticket-card.svelte";

    const numbers = new Array(20);
    numbers.fill(0);
    
    
</script>

<div class="flex flex-col justify-center items-center gap-y-4">
    {#each numbers as number}
        
            <TicketCard />

    {/each}
</div>

<!-- Take a look at more options for tailwindcss in skeleton (cards etc) -->
<!-- Make sure theme is applied, use variant colors -->

