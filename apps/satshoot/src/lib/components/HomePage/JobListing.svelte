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
    import Button from '../UI/Buttons/Button.svelte';

    let newJobs: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let jobList: Set<TicketEvent> = new Set();

    $: if ($newJobs) {
        // We just received a job
        orderEventsChronologically($newJobs);
        const newJobList = new Set(
            $newJobs.filter((t: TicketEvent) => {
                // New job check: if a job status is changed this removes not new jobs
                const newJob = t.status === TicketStatus.New;
                // wot is always at least 3 if there is a user logged in
                // only update filter if other users are also present
                const partOfWot = $wot?.size > 2 && $wot.has(t.pubkey);

                return newJob && partOfWot;
            })
        );

        jobList = new Set(Array.from(newJobList).slice(0, 8));
    }

    onMount(() => {
        checkRelayConnections();

        newJobs = $ndk.storeSubscribe(
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
        $newJobs = $newJobs;
    });

    onDestroy(() => {
        if (newJobs) newJobs.unsubscribe();
    });

    const viewMoreBtnClasses =
        'transform scale-100 w-full max-w-[200px] hover:max-w-[225px] dark:text-white-500 dark:border-white-100 ';
</script>

<div class="w-full flex flex-col justify-center items-center py-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
            <div class="w-full flex flex-col gap-[15px]">
                <h2 class="text-[40px] font-[500]">Latest Job Listings</h2>
            </div>
            <div
                class="w-full grid grid-cols-4 gap-[25px] max-[1200px]:grid-cols-3 max-[992px]:grid-cols-2 max-[768px]:grid-cols-1"
            >
                {#if jobList.size > 0}
                    {#each Array.from(jobList) as job (job.id)}
                        <JobCard {job} />
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
                <Button variant="outlined" classes={viewMoreBtnClasses} href="/jobs/">
                    View More
                </Button>
            </div>
        </div>
    </div>
</div>
