<script lang="ts">
    import type { TicketEvent } from "$lib/events/TicketEvent";
    import { newTickets } from "$lib/stores/troubleshoot-eventstores";
    import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";

    import type { NDKTag } from "@nostr-dev-kit/ndk";

    import { InputChip } from "@skeletonlabs/skeleton";
    import pageTitleStore from "$lib/stores/pagetitle-store";

    $pageTitleStore = 'BTC Troubleshoot';

    let filterInput = '';
    let filterList: string[] = [];
    let ticketList: Set<TicketEvent> = new Set;

    $: {
        if($newTickets || filterList) {
            // We just received a new ticket but we are not filtering
            if (filterList.length === 0) {
                ticketList = new Set($newTickets);
                console.log('filter length 0!', $newTickets)
            } else {
                // We need to check all tickets against all filters
                console.log('check filters...')
                ticketList = new Set();
                $newTickets.forEach((ticket: TicketEvent) => {
                    filterList.forEach((filter: string) => {
                        const lowerCaseFilter = filter.toLowerCase();

                        const lowerCaseTitle = ticket.title.toLowerCase();
                        const lowerCaseDescription = ticket.description.toLowerCase();

                        let tagsContain: boolean = false;
                        ticket.tags.forEach((tag: NDKTag) => {
                            if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                                tagsContain = true;
                                console.log('tag contains!')
                            }
                        });

                        const titleContains: boolean = lowerCaseTitle.includes(lowerCaseFilter);
                        const descContains: boolean = lowerCaseDescription.includes(lowerCaseFilter);
                        if (titleContains) console.log('tag contains!');
                        if (descContains) console.log('desc contains!');

                        if (titleContains || descContains || tagsContain) {
                            ticketList.add(ticket);
                        }
                    });
                });
                console.log('ticketList:', ticketList)
                ticketList = ticketList;
            }
        }
    }

</script>

<a href="/post-ticket" class="btn fixed bottom-20 right-10 xl:btn-xl lg:btn-lg md:btn-md bg-primary-300-600-token">
    <span>Get Help</span>
</a>


<div class="flex flex-col justify-center gap-y-2 mt-2">
    <div class="sticky top-0 w-80 mx-auto flex gap-x-2 items-center justify-center">
        <InputChip
            bind:value={filterList}
            bind:input={filterInput}
            name="chips"
            placeholder="Filter by Title, Description or Tags"
        />
        <button 
            class="btn btn-icon"
            on:click={() => {
                    if (filterInput) {
                        filterList = [...filterList, filterInput];
                        filterInput = '';
                    }
                }
            }
        >
            <i class="fa-solid fa-magnifying-glass text-lg"></i>
        </button>
    </div>

    <div class="grid grid-cols-1 itesm-center center gap-y-4 mx-8 mb-8">
        {#each ticketList as ticket}

            <TicketCard {ticket}/>

        {/each}
    </div>
</div>
