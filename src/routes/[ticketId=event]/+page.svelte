<script lang="ts">
    import type { TicketEvent } from "$lib/events/TicketEvent";
    import { tickets, offers } from "$lib/stores/troubleshoot-eventstores";
    import ndk from "$lib/stores/ndk";

    import { getModalStore } from "@skeletonlabs/skeleton";
    import { page } from '$app/stores';
    import UserCard from "$lib/components/User/UserCard.svelte";
    
    const modalStore = getModalStore();

    let ticket: TicketEvent | undefined = undefined;

    $tickets.forEach((ticketEvent) => {
        if (ticketEvent.encode() === $page.params.ticketId) {
            ticket = ticketEvent;
        }
    });

    console.log(ticket)



    
</script>

<div class="flex flex-col justify-center gap-y-4 mt-4" >
    {#if ticket}
        <h2 class="text-center font-bold" >Ticket:</h2>
        <div class="card">

            <header class="card-header">
                <h2 class="text-center text-2xl font-bold" >{ticket.title ?? 'No title'}</h2>
            </header>

            <section class="p-4 text-lg">{ticket.description ?? 'No description!'}</section>

            <footer class="items-center flex flex-wrap card-footer">
                {#each ticket.tTags as tag }
                    <div class="px-2 rounded-token">
                        <span class="text-sm badge variant-filled-surface">{ tag[1] }</span>
                    </div>
                {/each}
            </footer>

        </div>
            <!-- User -->
        <h2 class="text-center font-bold" >Posted by:</h2>
        <UserCard ndk={$ndk} npub={ticket.author.npub} />
    {:else}
        <h2 class="text-center font-bold" >Error: Ticket not found among ticket events!</h2>
    {/if}
</div>


<!--     TODO: -->
<!-- - "asked b
y" in footer -->
