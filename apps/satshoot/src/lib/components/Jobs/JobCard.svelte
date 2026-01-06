<script lang="ts">
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import { NDKSubscriptionCacheUsage, type NDKFilter } from '@nostr-dev-kit/ndk';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import Author from './Author.svelte';
    import JobActions from './JobActions.svelte';
    import JobDetails from './JobDetails.svelte';
    import JobBids from './JobBids.svelte';
    import { wot } from '$lib/stores/wot';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';

    enum Tabs {
        JobDescription,
        Author,
        Bids,
        Actions,
    }

    interface Props {
        job: JobEvent;
        showBidsDetail?: boolean;
    }

    let { job, showBidsDetail = false }: Props = $props();

    let highlightBidsTab = $state(false);
    let selectedTab = $state(Tabs.JobDescription);

    const bech32ID = $derived(job.encode());

    $effect(() => {
        if (!showBidsDetail || job?.status !== JobStatus.New) return;

        const bidsFilter: NDKFilter = {
            kinds: [ExtendedNDKKind.FreelanceBid],
            '#a': [job.jobAddress],
        };

        $ndk.fetchEvents(bidsFilter, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            groupable: true,
            groupableDelay: 500,
        }).then((bids) => {
            highlightBidsTab = Array.from(bids).filter((b) => $wot.has(b.pubkey)).length > 0;
        });
    });

    const tabs = $derived.by(() => [
        {
            icon: 'bxs-card',
            name: Tabs.JobDescription,
        },
        showBidsDetail
            ? {
                  icon: 'bxs-info-circle',
                  name: Tabs.Bids,
              }
            : {
                  icon: 'bxs-user',
                  name: Tabs.Author,
              },
        {
            icon: 'bxs-grid-alt',
            name: Tabs.Actions,
        },
    ]);

    const jobCardBtnClasses = 'border-0 scale-100 ' + 'grow ';
</script>

<Card classes="border-[1px_solid_rgba(0,0,0,0.1)] gap-[0px]  overflow-hidden p-[0px]">
    <div class="w-full flex flex-col gap-[0px] p-[10px] min-h-[240px]">
        {#if selectedTab === Tabs.JobDescription}
            <JobDetails title={job.title} description={job.description} {bech32ID} />
        {:else if selectedTab === Tabs.Author}
            <Author user={job.pubkey} />
        {:else if selectedTab === Tabs.Bids}
            <JobBids {job} />
        {:else if selectedTab === Tabs.Actions}
            <JobActions {job} />
        {/if}
    </div>
    <div
        class="w-full flex flex-col gap-[0px] p-[8px] border-t-[1px_solid_rgba(0,0,0,0.1)] bg-black-50 dark:bg-black-100"
    >
        <div class="jobCardButtons w-full flex flex-row gap-[5px] p-[0px] h-full overflow-hidden">
            {#each tabs as tab}
                <Button
                    variant={tab.name === selectedTab ? 'contained' : 'text'}
                    classes={jobCardBtnClasses}
                    onClick={() => (selectedTab = tab.name)}
                >
                    <i class={`bx ${tab.icon}`}></i>
                    {#if tab.name === Tabs.Bids && highlightBidsTab}
                        <div
                            class="h-[4px] w-full max-w-[35px] rounded-[10px] absolute bottom-[2px] bg-red-400"
                        ></div>
                    {/if}
                </Button>
            {/each}
        </div>
    </div>
    <div class="w-full flex flex-row gap-[0px] border-t-[1px_solid_rgba(0,0,0,0.11)]">
        <Button href={'/' + bech32ID + '/'} variant="text" classes="rounded-[0]" fullWidth>
            <i class="bx bxs-show"></i>
        </Button>
    </div>
</Card>
