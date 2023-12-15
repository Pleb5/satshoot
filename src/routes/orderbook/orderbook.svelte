<script lang="ts">
    import TicketCard from "./ticket-card.svelte";

    const numbers = new Array(20);
    numbers.fill(0);
    
</script>
<!-- modify me to skeleton: need sticky!-->
<button class="px-2.5 py-2 bg-blue-600 rounded-3xl text-center text-white text-xl font-semibold leading-tight">
    Get Help
</button>

<div class="flex flex-col justify-center items-center gap-y-4">
    {#each numbers as number}
        
            <TicketCard />

    {/each}
</div>

<!-- Take a look at more options for tailwindcss in skeleton (cards etc) -->
<!-- Make sure theme is applied, use variant colors -->

