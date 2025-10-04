<script lang="ts">
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';
    import { NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import JobCard from '../Jobs/JobCard.svelte';
    import { onDestroy } from 'svelte';
    import { OnboardingJobEvent, OnboardingJobStatus } from '$lib/events/OnboardingJobEvent';

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
        OnboardingJobEvent
    );

    let jobList = $derived.by(() => {
        const copiedJobs = [...$newJobs];
        orderEventsChronologically(copiedJobs);

        const newJobList = copiedJobs.filter((t: OnboardingJobEvent) => {
            const newJob = t.status === OnboardingJobStatus.New;
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
</script>

<div class="w-full flex flex-col gap-y-1 bg-gray-100 p-4 rounded-md">
    <h1 class="max-sm:text-2l sm:text-[30px] font-[500]">⭐ Onboarding ⭐</h1>
    <p>Complete the following jobs to earn rewards on SatShoot:</p>
    {#each Array.from(jobList) as job (job.id)}
        <JobCard {job} />
    {/each}
</div>
