<!-- All cards have title, shortened description and tags -->
<script lang="ts">
    import { TicketEvent } from "$lib/events/TicketEvent";

    export let ticket: TicketEvent;
</script>


<div class="card">
    <header class="card-header">
        <a class="anchor" href="/">{ticket.title ?? 'No title'}</a>
    </header>

    <section class="p-4">{ticket.description ?? 'No description!'}</section>
    <footer class="items-center flex flex-wrap card-footer">
        {#each ticket.tTags as tag }
            <div class="px-2 rounded-token">
                <span class="badge variant-filled-surface">{ tag[1] }</span>
            </div>
        {/each}
    </footer>
</div>


<!--     TODO: -->
<!-- - "asked by" in footer -->
