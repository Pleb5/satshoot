<script lang="ts">
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';
    import { NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy, onMount } from 'svelte';
    import JobCard from '../Jobs/JobCard.svelte';
    import { goto } from '$app/navigation';

    let newTickets: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let ticketList: Set<TicketEvent> = new Set();

    $: if ($newTickets) {
        // We just received a ticket
        orderEventsChronologically($newTickets);
        const newTicketList = new Set(
            $newTickets.filter((t: TicketEvent) => {
                // New ticket check: if a ticket status is changed this removes not new tickets
                const newTicket = t.status === TicketStatus.New;
                // wot is always at least 3 if there is a user logged in
                // only update filter if other users are also present
                const partOfWot = $wot?.size > 2 && $wot.has(t.pubkey);

                return newTicket && partOfWot;
            })
        );

        ticketList = new Set(Array.from(newTicketList).slice(0, 8));
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

    const viewMoreBtnClasses =
        'transition-all ease duration-[0.3s] outline-0 p-[10px_20px] rounded-[5px] ' +
        'font-semibold text-[18px] transform scale-100 whitespace-nowrap flex flex-row ' +
        'justify-center items-center gap-[10px] bg-[rgba(255,255,255,0)] text-[rgba(0,0,0,0.5)] ' +
        'border-[1px] border-solid border-[rgba(0,0,0,0.1)] w-full max-w-[200px] hover:bg-[#3b73f6] ' +
        'hover:text-[rgb(255,255,255)] hover:border-[1px_solid_rgba(0,0,0,0)] hover:max-w-[225px]';
</script>

<div class="w-full flex flex-col justify-center items-center py-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
            <div class="w-full flex flex-col gap-[15px]">
                <h2 class="text-[40px] font-[500]">Latest Job Listings</h2>
                <p>
                    Discover latest jobs posts by individuals who are looking to have their project
                    developed or issue solved
                </p>
            </div>
            <div
                class="w-full grid grid-cols-4 gap-[25px] max-[1200px]:grid-cols-3 max-[992px]:grid-cols-2 max-[768px]:grid-cols-1"
            >
                {#if ticketList.size > 0}
                    {#each Array.from(ticketList) as ticket (ticket.id)}
                        <JobCard {ticket} />
                    {/each}
                {:else}
                    <div class="p-4 space-y-4 w-full">
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
                {/if}
            </div>
            <div class="w-full flex flex-row justify-center items-inherit gap-[15px]">
                <button
                    on:click={() => goto('/ticket-feed/')}
                    type="button"
                    class={viewMoreBtnClasses}
                >
                    View more
                </button>
            </div>
        </div>
    </div>
</div>
