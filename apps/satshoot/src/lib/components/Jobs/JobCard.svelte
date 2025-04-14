<script lang="ts">
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { NDKKind, NDKSubscriptionCacheUsage, type NDKFilter } from '@nostr-dev-kit/ndk';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import Author from './Author.svelte';
    import JobActions from './JobActions.svelte';
    import JobDetails from './JobDetails.svelte';
    import JobOffers from './JobOffers.svelte';

    enum Tabs {
        JobDescription,
        Author,
        Offers,
        Actions,
    }

    interface Props {
        job: TicketEvent;
        showOffersDetail?: boolean;
    }

    let { job, showOffersDetail = false }: Props = $props();

    // Reactive state
    let highlightOffersTab = $state(false);
    let selectedTab = $state(Tabs.JobDescription);

    // Derived state
    const bech32ID = $derived(job.encode());

    // Effect to check for offers when needed
    $effect(() => {
        if (!showOffersDetail || job?.status !== TicketStatus.New) return;

        const offersFilter: NDKFilter = {
            kinds: [NDKKind.FreelanceOffer],
            '#a': [job.ticketAddress],
        };

        $ndk.fetchEvents(offersFilter, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((offers) => {
            highlightOffersTab = offers.size > 0;
        });
    });

    const tabs = [
        {
            icon: 'bxs-card',
            name: Tabs.JobDescription,
        },
        showOffersDetail
            ? {
                  icon: 'bxs-info-circle',
                  name: Tabs.Offers,
              }
            : {
                  icon: 'bxs-user',
                  name: Tabs.Author,
              },
        {
            icon: 'bxs-grid-alt',
            name: Tabs.Actions,
        },
    ];

    const jobCardBtnClasses = 'border-0 scale-100 ' + 'grow ';
</script>

<Card classes="border-[1px_solid_rgba(0,0,0,0.1)] gap-[0px]  overflow-hidden p-[0px]">
    <div class="w-full flex flex-col gap-[0px] p-[10px] min-h-[240px]">
        {#if selectedTab === Tabs.JobDescription}
            <JobDetails title={job.title} description={job.description} {bech32ID} />
        {:else if selectedTab === Tabs.Author}
            <Author user={job.pubkey} />
        {:else if selectedTab === Tabs.Offers}
            <JobOffers {job} />
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
                    {#if tab.name === Tabs.Offers && highlightOffersTab}
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
