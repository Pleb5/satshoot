<script lang="ts">
    import { TicketStatus, TicketEvent } from "$lib/events/TicketEvent";
    import TicketCard from "$lib/components/Cards/TicketCard.svelte";

    import { wot } from '$lib/stores/wot';
    import ndk, { connected } from "$lib/stores/ndk";
    import { online } from "$lib/stores/network";
    import { checkRelayConnections, orderEventsChronologically } from "$lib/utils/helpers";

    import { NDKKind, NDKSubscriptionCacheUsage, type NDKTag } from "@nostr-dev-kit/ndk";

    import { InputChip } from "@skeletonlabs/skeleton";
    import ReadyToWorkModal from "$lib/components/Modals/ReadyToWorkModal.svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent, ModalSettings } from "@skeletonlabs/skeleton";
    import type { ExtendedBaseType, NDKEventStore } from "@nostr-dev-kit/ndk-svelte";
    import { onDestroy, onMount } from "svelte";
    import BullhornIcon from "$lib/components/Icons/BullhornIcon.svelte";

    const modalStore = getModalStore();

    let newTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let filterInput = '';
    let filterList: string[] = [];
    let ticketList: Set<TicketEvent> = new Set;
    // tracks if user-defined filtering returned anything
    let noResults = false;

    function filterTickets() {
        // We need to check all tickets against all filters
        if (filterList.length > 0) {
            const filteredTicketList:Set<TicketEvent> = new Set();
            ticketList.forEach((ticket: TicketEvent) => {
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
                        filteredTicketList.add(ticket);
                    }
                });
            });

            if (filteredTicketList.size === 0) noResults = true;

            ticketList = filteredTicketList;
        }
    }

    function addTagAndFilter(tag: string) {
        if (!filterList.includes(tag)) {
            filterList.push(tag);
            filterList = filterList;
            filterTickets();
        }
    }

    function readyToWork() {
        const modalComponent: ModalComponent = {
            ref: ReadyToWorkModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    $: if($newTickets && filterList) {
        // We just received a ticket 
        orderEventsChronologically($newTickets);
        ticketList = new Set($newTickets.filter((t: TicketEvent) => {
            // New ticket check: if a ticket status is changed this removes not new tickets
            const newTicket = (t.status === TicketStatus.New);
            // wot is always at least 3 if there is a user logged in
            // only update filter if other users are also present
            const partOfWot = $wot?.size > 2 && $wot.has(t.pubkey);

            return newTicket && partOfWot;
        }));

        if (filterList.length > 0) {
            filterTickets();
        }
    }

    onMount(() => {
        checkRelayConnections();

        newTickets = $ndk.storeSubscribe(
            {
                kinds: [NDKKind.FreelanceTicket],
            },
            {
                autoStart: true,
                closeOnEose: false,
                groupable: false,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            },
            TicketEvent
        );
        $newTickets = $newTickets;
    });

    onDestroy(() => {
        if (newTickets) newTickets.unsubscribe();
    });

</script>

<div class="flex flex-col justify-center gap-y-2 mt-2">
    <div class="sticky top-2 w-80 z-40 mx-auto flex gap-x-2 items-center justify-center">
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

    {#if ticketList && ticketList.size > 0}
        <div class="grid grid-cols-1 gap-y-4 mb-8">
            {#each ticketList as ticket (ticket.id)}
                <div class="flex justify-center">
                    <TicketCard {ticket}
                        titleSize={'md lg:text-xl'}
                        tagCallback={addTagAndFilter} 
                    />
                </div>
            {/each}
        </div>
    {:else if noResults}
        <h2 class="h2 font-bold text-center">No search results!</h2>
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
{#if $connected && $online}
    <div class="fixed bottom-20 right-8">
        <button class="btn btn-icon-xl bg-primary-300-600-token"
            on:click={()=> {
                readyToWork();
            }}
        >
            <BullhornIcon extraClasses={'text-3xl '}/>
        </button>
    </div>
{/if}
