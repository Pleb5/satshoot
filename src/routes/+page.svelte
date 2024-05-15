<script lang="ts">
    import { TicketStatus, type TicketEvent } from "$lib/events/TicketEvent";
    import { allTickets } from "$lib/stores/troubleshoot-eventstores";
    import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";

    import type { NDKTag } from "@nostr-dev-kit/ndk";

    import { InputChip } from "@skeletonlabs/skeleton";
    import { onMount } from "svelte";

    let filterInput = '';
    let filterList: string[] = [];
    let ticketList: Set<TicketEvent> = new Set;

    function filterTickets() {
        // We need to check all tickets against all filters
        if (filterList.length > 0) {
            ticketList = new Set();
            $allTickets.forEach((ticket: TicketEvent) => {
                filterList.forEach((filter: string) => {
                    const lowerCaseFilter = filter.toLowerCase();

                    const lowerCaseTitle = ticket.title.toLowerCase();
                    const lowerCaseDescription = ticket.description.toLowerCase();

                    let tagsContain: boolean = false;
                    ticket.tags.forEach((tag: NDKTag) => {
                        if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                            tagsContain = true;
                        }
                    });

                    const titleContains: boolean = lowerCaseTitle.includes(lowerCaseFilter);
                    const descContains: boolean = lowerCaseDescription.includes(lowerCaseFilter);

                    if (titleContains || descContains || tagsContain) {
                        ticketList.add(ticket);
                    }
                });
            });
            ticketList = ticketList;
        }
    }

    function addTagAndFilter(tag: string) {
        if (!filterList.includes(tag)) {
            filterList.push(tag);
            filterList = filterList;
            filterTickets();
        }
    }

    $: {
        if($allTickets || filterList) {
            // We just received a ticket 
            ticketList = new Set($allTickets.filter((t: TicketEvent) => {
                return t.status === TicketStatus.New;
            }));
            console.log('ticketList', ticketList)
            if (filterList.length > 0) {
                filterTickets();
            }
        }
    }

    onMount(()=>{
        ticketList = new Set($allTickets);
    });

</script>

<div class="flex flex-col justify-center gap-y-2 mt-2">
    <div class="sticky top-2 w-80 mx-auto flex gap-x-2 items-center justify-center">
        <InputChip
            bind:value={filterList}
            bind:input={filterInput}
            name="chips"
            placeholder="Filter by Title, Description or Tags"
        />
        <!-- <button  -->
        <!--     class="btn btn-icon" -->
        <!--     on:click={() => { -->
        <!--             if (filterInput) { -->
        <!--                 filterList = [...filterList, filterInput]; -->
        <!--                 filterInput = ''; -->
        <!--             } -->
        <!--         } -->
        <!--     } -->
        <!-- > -->
        <!--     <i class="fa-solid fa-magnifying-glass text-lg"></i> -->
        <!-- </button> -->
    </div>

    {#if ticketList.size > 0}
        <div class="grid grid-cols-1 gap-y-4 mx-8 mb-8">
            {#each ticketList as ticket (ticket.id)}
                <div class="flex justify-center">
                    <TicketCard {ticket}
                        titleSize={'md lg:text-xl'}
                        tagCallback={addTagAndFilter} 
                    />
                </div>
            {/each}
        </div>
    {:else}
        <div class="flex flex-col items-center gap-y-8">
            {#each {length: 4} as _ }
                <section class="w-[300px] md:w-[400px]">
                    <div class="p-4 space-y-4">
                        <div class="placeholder animate-pulse" />
                        <div class="grid grid-cols-3 gap-8">
                            <div class="placeholder animate-pulse" />
                            <div class="placeholder animate-pulse" />
                            <div class="placeholder animate-pulse" />
                        </div>
                        <div class="grid grid-cols-4 gap-4">
                            <div class="placeholder animate-pulse" />
                            <div class="placeholder animate-pulse" />
                            <div class="placeholder animate-pulse" />
                            <div class="placeholder animate-pulse" />
                        </div>
                    </div>
                </section>
            {/each}
        </div>
    {/if}
</div>
