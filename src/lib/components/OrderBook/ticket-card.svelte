<script lang="ts">
    import type { TicketEvent } from "$lib/events/TicketEvent";
    
    export let ticket: TicketEvent;
    const bech32ID = ticket.encode();
</script>


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

