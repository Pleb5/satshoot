<script lang="ts">
    import { page } from '$app/state';
    import BidCard from '$lib/components/Cards/BidCard.svelte';
    import UserCard from '$lib/components/Cards/UserCard.svelte';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Checkbox from '$lib/components/UI/Inputs/Checkbox.svelte';
    import { BidEvent } from '$lib/events/BidEvent';
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import { jobFilter, bidFilter, scrollToMyJobsAndMyBids } from '$lib/stores/gui';
    import ndk from '$lib/stores/session';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import currentUser from '$lib/stores/user';
    import { sessionInitialized } from '$lib/stores/session';
    import { orderEventsChronologically } from '$lib/utils/helpers';
    import { NDKKind, type NDKFilter, type NDKTag } from '@nostr-dev-kit/ndk';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import { nip19 } from 'nostr-tools';
    import { onDestroy, onMount } from 'svelte';
    import { debounce } from '$lib/utils/misc';
    import Fuse from 'fuse.js';

    enum BidStatus {
        Unknown,
        Pending,
        Won,
        Lost,
    }

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));
    let npub = page.params.npub;
    let pubkey = nip19.decode(npub).data as string;
    let user = $ndk.getUser({ npub: npub });

    const subOptions: NDKSubscribeOptions = {
        autoStart: false,
    };

    const allJobsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceJob],
    };
    const allJobsOfUser = $ndk.storeSubscribe<JobEvent>(allJobsFilter, subOptions, JobEvent);

    const allBidsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceBid],
    };
    const allBidsOfUser = $ndk.storeSubscribe<BidEvent>(allBidsFilter, subOptions, BidEvent);

    const dTagOfJobs = $derived(
        $allBidsOfUser.map((bid) => bid.referencedJobAddress.split(':')[2])
    );

    // jobs on which user has made bids
    const appliedJobsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceJob],
    };
    const appliedJobs = $ndk.storeSubscribe<JobEvent>(
        appliedJobsFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        JobEvent
    );

    // Track debounced jobs
    let debouncedUserJobs = $state<JobEvent[]>([]);
    let debouncedJobsTimer: NodeJS.Timeout | null = null; // Not reactive state

    // Track debounced jobs
    let debouncedUserBids = $state<BidEvent[]>([]);
    let debouncedBidsTimer: NodeJS.Timeout | null = null; // Not reactive state

    // Debounce the user jobs updates
    $effect(() => {
        // Only react to $allJobsOfUser changes
        const userJobs = $allJobsOfUser;

        if (debouncedJobsTimer) clearTimeout(debouncedJobsTimer);

        debouncedJobsTimer = setTimeout(() => {
            debouncedUserJobs = [...userJobs];
        }, 300); // 300ms debounce delay

        return () => {
            if (debouncedJobsTimer) clearTimeout(debouncedJobsTimer);
        };
    });

    // Debounce the user bid updates
    $effect(() => {
        // Only react to $allBidsOfUser changes
        const userBids = $allBidsOfUser;

        if (debouncedBidsTimer) clearTimeout(debouncedBidsTimer);

        debouncedBidsTimer = setTimeout(() => {
            debouncedUserBids = [...userBids];
        }, 300); // 300ms debounce delay

        return () => {
            if (debouncedBidsTimer) clearTimeout(debouncedBidsTimer);
        };
    });

    $effect(
        debounce(() => {
            if (dTagOfJobs.length > 0) {
                appliedJobs.subscription?.stop();
                appliedJobsFilter['#d'] = dTagOfJobs;
                appliedJobs.startSubscription();
            }
        }, 800)
    );

    const { new: isNew, inProgress, closed } = $derived($jobFilter);

    const filteredJobs = $derived.by(() => {
        let copied = [...debouncedUserJobs];
        orderEventsChronologically(copied);

        // filter based on status
        copied = copied.filter((job) => {
            const { status } = job;

            return (
                (isNew && status === JobStatus.New) ||
                (inProgress && status === JobStatus.InProgress) ||
                (closed && (status === JobStatus.Resolved || status === JobStatus.Failed))
            );
        });

        if (searchQuery && searchQuery.length > 0) {
            return filterJobs(copied, searchQuery);
        }

        return copied;
    });

    // filter based on search terms
    function filterJobs(jobs: JobEvent[], searchTerm: string): JobEvent[] {
        const fuse = new Fuse(jobs, {
            isCaseSensitive: false,
            shouldSort: true, // Whether to sort the result list, by score
            ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
            threshold: 0.6,
            minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
            keys: [
                {
                    name: 'title',
                    weight: 0.4,
                },
                {
                    name: 'description',
                    weight: 0.2,
                },
                {
                    name: 'tags',
                    weight: 0.4,
                },
            ],
        });

        const searchResult = fuse.search(searchTerm);

        const filteredJobList = searchResult.map(({ item }) => item);

        return filteredJobList;
    }

    const { pending, success, lost } = $derived($bidFilter);

    const filteredBids = $derived.by(() => {
        let copied = [...$allBidsOfUser];
        orderEventsChronologically(copied);

        copied = copied.filter((bid) => {
            const job = $appliedJobs?.find((job) => job.jobAddress === bid.referencedJobAddress);

            const bidStatus = job
                ? job.acceptedBidAddress
                    ? job.acceptedBidAddress === bid.bidAddress
                        ? BidStatus.Won
                        : BidStatus.Lost
                    : BidStatus.Pending
                : BidStatus.Unknown;

            return (
                (pending && bidStatus === BidStatus.Pending) ||
                (success && bidStatus === BidStatus.Won) ||
                (lost && bidStatus === BidStatus.Lost) ||
                bidStatus === BidStatus.Unknown
            );
        });

        if (searchQuery && searchQuery.length > 0) {
            return filterBids(copied, searchQuery);
        }

        return copied;
    });

    // filter based on search terms
    function filterBids(bids: BidEvent[], searchTerm: string): BidEvent[] {
        const fuse = new Fuse(bids, {
            isCaseSensitive: false,
            shouldSort: true,
            ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
            threshold: 0.6,
            minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
            keys: [
                {
                    name: 'description',
                    weight: 0.3,
                },
                {
                    name: 'tags',
                    weight: 0.7,
                },
            ],
        });

        const searchResult = fuse.search(searchTerm);

        const filteredBidList = searchResult.map(({ item }) => item);

        return filteredBidList;
    }

    let initialized = $state(false);
    $effect(() => {
        if (pubkey && $sessionInitialized && !initialized) {
            initialized = true;
            allJobsFilter.authors = [pubkey];
            allBidsFilter.authors = [pubkey];

            allJobsOfUser.startSubscription();
            allBidsOfUser.startSubscription();
        }
    });

    let myJobsAndMyBidsElement = $state<HTMLDivElement>();
    $effect(() => {
        if (myJobsAndMyBidsElement && $scrollToMyJobsAndMyBids) {
            $scrollToMyJobsAndMyBids = false;
            setTimeout(() => {
                if (myJobsAndMyBidsElement) {
                    myJobsAndMyBidsElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    });
                }
            }, 600);
        }
    });

    onDestroy(() => {
        if (allJobsOfUser) allJobsOfUser.empty();
        if (allBidsOfUser) allBidsOfUser.empty();
        if (appliedJobs) appliedJobs.empty();
        if (debouncedJobsTimer) clearTimeout(debouncedJobsTimer);
        if (debouncedBidsTimer) clearTimeout(debouncedBidsTimer);
    });

    let isOwnProfile = $derived($currentUser && $currentUser?.pubkey === pubkey);

    let tabs = $derived([
        { id: ProfilePageTabs.Jobs, label: `${isOwnProfile ? 'My' : ''} Jobs` },
        { id: ProfilePageTabs.Bids, label: `${isOwnProfile ? 'My' : ''} Bids` },
    ]);
</script>

<div class="w-full flex flex-col gap-0 grow mt-0 sm:mt-5 mb-20 sm:mb-0">
    <!-- Section start -->
    <div class="w-full flex flex-col justify-center items-center">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col max-[768px]:gap-0">
                    <UserCard {user} />
                    <div
                        id="job-and-bids"
                        class="w-full flex flex-col gap-[15px] relative"
                        bind:this={myJobsAndMyBidsElement}
                    >
                        <div class="w-full flex flex-col gap-[10px]">
                            <TabSelector {tabs} bind:selectedTab={$profileTabStore} />
                            <div class="w-full flex flex-col">
                                {#if $profileTabStore === ProfilePageTabs.Jobs}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <Card classes="flex-row flex-wrap gap-[10px] p-[5px]">
                                            <Checkbox
                                                id="new-jobs"
                                                label="New"
                                                bind:checked={$jobFilter.new}
                                            />
                                            <Checkbox
                                                id="inProgress-jobs"
                                                label="In Progress"
                                                bind:checked={$jobFilter.inProgress}
                                            />
                                            <Checkbox
                                                id="closed-jobs"
                                                label="Closed"
                                                bind:checked={$jobFilter.closed}
                                            />
                                        </Card>
                                        <div class="w-full flex flex-col gap-[15px]">
                                            <div
                                                class="w-full grid grid-cols-3 gap-[25px] max-[1200px]:grid-cols-2 max-[992px]:grid-cols-1 max-[768px]:grid-cols-1"
                                            >
                                                {#each filteredJobs as job (job.id)}
                                                    <JobCard {job} showBidsDetail />
                                                {/each}
                                            </div>
                                            <!-- Pagination -->
                                        </div>
                                    </div>
                                {:else}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <Card classes="flex-row flex-wrap gap-[10px] p-[5px]">
                                            <Checkbox
                                                id="pending-bids"
                                                label="Pending"
                                                bind:checked={$bidFilter.pending}
                                            />
                                            <Checkbox
                                                id="success-bids"
                                                label="Success"
                                                bind:checked={$bidFilter.success}
                                            />
                                            <Checkbox
                                                id="lost-bids"
                                                label="Lost"
                                                bind:checked={$bidFilter.lost}
                                            />
                                        </Card>
                                        <div class="w-full flex flex-col gap-[15px]">
                                            <div class="w-full flex flex-col gap-[15px]">
                                                {#each filteredBids as bid (bid.id)}
                                                    <BidCard
                                                        {bid}
                                                        skipUserProfile
                                                        skipReputation
                                                        showJobDetail
                                                    />
                                                {/each}
                                            </div>
                                            <!-- Pagination -->
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
