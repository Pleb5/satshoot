<script lang="ts">
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';
    import { NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import JobCard from '../Jobs/JobCard.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import { onDestroy } from 'svelte';

    // State
    const newJobs = $ndk.storeSubscribe(
        {
            kinds: [NDKKind.FreelanceJob],
        },
        {
            autoStart: false,
            closeOnEose: false,
            groupable: false,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        },
        JobEvent
    );

    let jobList = $derived.by(() => {
        const copiedJobs = [...$newJobs];
        orderEventsChronologically(copiedJobs);

        const newJobList = copiedJobs.filter((t: JobEvent) => {
            const newJob = t.status === JobStatus.New;
            const partOfWot = $wot.has(t.pubkey);

            return newJob && partOfWot;
        });

        return new Set(newJobList.slice(0, 8));
    });

    // Initialize jobs subscription
    $effect(() => {
        if ($sessionInitialized) {
            checkRelayConnections();

            newJobs.startSubscription();
        }
    });

    onDestroy(() => {
        newJobs.empty();
    });

    const viewMoreBtnClasses =
        'transform scale-100 w-full max-w-[200px] hover:max-w-[225px] dark:text-white dark:border-white-100 ';
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
                        <div class="placeholder animate-pulse"></div>
                        <div class="grid grid-cols-3 gap-8">
                            <div class="placeholder animate-pulse"></div>
                            <div class="placeholder animate-pulse"></div>
                            <div class="placeholder animate-pulse"></div>
                        </div>
                        <div class="grid grid-cols-4 gap-4">
                            <div class="placeholder animate-pulse"></div>
                            <div class="placeholder animate-pulse"></div>
                            <div class="placeholder animate-pulse"></div>
                            <div class="placeholder animate-pulse"></div>
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
