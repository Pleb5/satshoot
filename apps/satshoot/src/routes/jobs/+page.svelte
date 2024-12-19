<script lang="ts">
    import { TicketStatus, TicketEvent } from '$lib/events/TicketEvent';
    import TicketCard from '$lib/components/Cards/TicketCard.svelte';

    import { wot } from '$lib/stores/wot';
    import ndk, { connected } from '$lib/stores/ndk';
    import { online } from '$lib/stores/network';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';

    import { NDKKind, NDKSubscriptionCacheUsage, type NDKTag } from '@nostr-dev-kit/ndk';

    import { InputChip } from '@skeletonlabs/skeleton';
    import ReadyToWorkModal from '$lib/components/Modals/ReadyToWorkModal.svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy, onMount } from 'svelte';
    import BullhornIcon from '$lib/components/Icons/BullhornIcon.svelte';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import { JobsPerPage } from '$lib/utils/misc';

    const modalStore = getModalStore();

    let newTickets: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let filterInput = '';
    let filterList: string[] = [];
    let ticketList: Set<TicketEvent> = new Set();
    // tracks if user-defined filtering returned anything
    let noResults = false;

    let currentPage = 1;

    function filterTickets() {
        // We need to check all tickets against all filters
        if (filterList.length > 0) {
            const filteredTicketList: Set<TicketEvent> = new Set();
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

    $: if ($newTickets && filterList) {
        // We just received a ticket
        orderEventsChronologically($newTickets);
        ticketList = new Set(
            $newTickets.filter((t: TicketEvent) => {
                // New ticket check: if a ticket status is changed this removes not new tickets
                const newTicket = t.status === TicketStatus.New;
                // wot is always at least 3 if there is a user logged in
                // only update filter if other users are also present
                const partOfWot = $wot?.size > 2 && $wot.has(t.pubkey);

                return newTicket && partOfWot;
            })
        );

        if (filterList.length > 0) {
            filterTickets();
        }
    }

    function handlePrev() {
        currentPage -= 1;
    }

    function handleNext() {
        currentPage += 1;
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

    const paginationBtnClasses =
        'transition-all ease duration-[0.3s] py-[10px] px-[20px] rounded-[5px] ' +
        'font-[18px] bg-white text-[rgb(0,0,0,0.5)] hover:bg-[#3b82f6] disabled:cursor-not-allowed' +
        'hover:text-white max-[576px]:grow-[1] shadow-[0_0_4px_0_rgba(0,0,0,0.1)]';
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <div class="w-full flex flex-col justify-center items-center py-[50px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[35px] max-[576px]:gap-[25px]">
                <div class="w-full flex flex-col gap-[15px] justify-start">
                    <h2 class="text-[40px] font-[500]">Latest Job Listings</h2>
                    <p>
                        Discover latest jobs posts by individuals who are looking to have their
                        project developed or issue solved
                    </p>
                </div>
                <div class="w-full flex flex-row gap-[25px] max-[576px]:flex-col">
                    <div
                        class="flex flex-row gap-[5px] items-center grow-[1] max-[576px]:order-[2]"
                    >
                        <p class="font-[700] text-[rgba(0,0,0,0.65)]">Searching:</p>
                        <p>Term</p>
                    </div>
                    <div class="flex flex-row justify-end">
                        <div class="w-full flex flex-col gap-[5px]">
                            <div
                                class="flex flex-row rounded-[6px] overflow-hidden bg-white outline outline-[5px] outline-white border-[1px] border-[rgb(0,0,0,0.1)]"
                            >
                                <input
                                    class="w-full border-[0px] border-[rgb(0,0,0,0.15)] rounded-[0px] outline outline-[0px] py-[5px] px-[10px]"
                                    type="text"
                                    placeholder="Search..."
                                />
                                <button
                                    class="transition-all ease duration-[0.3s] bg-[#3b73f6] py-[5px] px-[15px] rounded-[0px] text-white hover:text-white hover:bg-[#3b82f6]"
                                    type="button"
                                >
                                    <i class="bx bx-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col">
                    <div class="w-full flex flex-col gap-[25px]">
                        <div
                            class="w-full grid grid-cols-3 gap-[25px] max-[1200px]:grid-cols-2 max-[992px]:grid-cols-1 max-[768px]:grid-cols-1"
                        >
                            {#if ticketList && ticketList.size > 0}
                                {#each Array.from(ticketList).slice((currentPage - 1) * JobsPerPage, currentPage * JobsPerPage) as ticket (ticket.id)}
                                    <JobCard {ticket} />
                                {/each}
                            {:else if noResults}
                                <h2 class="h2 font-bold text-center">No search results!</h2>
                            {:else}
                                <div class="flex flex-col items-center gap-y-8">
                                    {#each { length: 4 } as _}
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
                        <div class="w-full flex flex-row justify-center items-center">
                            <div
                                class="w-full max-w-[300px] flex flex-row gap-[15px] justify-center items-center max-[576px]:flex-wrap"
                            >
                                <button
                                    class="{paginationBtnClasses} max-[576px]:order-[2]"
                                    type="button"
                                    on:click={handlePrev}
                                    disabled={currentPage === 1}
                                >
                                    <i class="bx bxs-chevron-left"></i>
                                </button>
                                <div
                                    class="flex flex-row justify-center items-center max-[576px]:w-[100%]"
                                >
                                    <p>Current page: {currentPage}</p>
                                </div>
                                <button
                                    class="{paginationBtnClasses} max-[576px]:order-[3]"
                                    type="button"
                                    on:click={handleNext}
                                    disabled={ticketList.size <= currentPage * JobsPerPage}
                                >
                                    <i class="bx bxs-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
{#if $connected && $online}
    <div class="fixed bottom-20 right-8">
        <button
            class="btn btn-icon-xl bg-primary-300-600-token"
            on:click={() => {
                readyToWork();
            }}
        >
            <BullhornIcon extraClasses={'text-3xl '} />
        </button>
    </div>
{/if}
