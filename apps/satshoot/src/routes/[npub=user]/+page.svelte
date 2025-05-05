<script lang="ts">
    import { page } from '$app/state';
    import OfferCard from '$lib/components/Cards/OfferCard.svelte';
    import UserCard from '$lib/components/Cards/UserCard.svelte';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Checkbox from '$lib/components/UI/Inputs/Checkbox.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import { jobFilter, offerFilter, scrollToMyJobsAndMyOffers } from '$lib/stores/gui';
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

    enum OfferStatus {
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
        kinds: [NDKKind.FreelanceTicket],
    };
    const allJobsOfUser = $ndk.storeSubscribe<TicketEvent>(allJobsFilter, subOptions, TicketEvent);

    const allOffersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOffer],
    };
    const allOffersOfUser = $ndk.storeSubscribe<OfferEvent>(
        allOffersFilter,
        subOptions,
        OfferEvent
    );

    const dTagOfJobs = $derived(
        $allOffersOfUser.map((offer) => offer.referencedTicketAddress.split(':')[2])
    );

    // jobs on which user has made offers
    const appliedJobsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceTicket],
    };
    const appliedJobs = $ndk.storeSubscribe<TicketEvent>(
        appliedJobsFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        TicketEvent
    );

    // Track debounced jobs
    let debouncedUserJobs = $state<TicketEvent[]>([]);
    let debouncedJobsTimer: NodeJS.Timeout | null = null; // Not reactive state

    // Track debounced jobs
    let debouncedUserOffers = $state<OfferEvent[]>([]);
    let debouncedOffersTimer: NodeJS.Timeout | null = null; // Not reactive state

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

    // Debounce the user offer updates
    $effect(() => {
        // Only react to $allOffersOfUser changes
        const userOffers = $allOffersOfUser;

        if (debouncedOffersTimer) clearTimeout(debouncedOffersTimer);

        debouncedOffersTimer = setTimeout(() => {
            debouncedUserOffers = [...userOffers];
        }, 300); // 300ms debounce delay

        return () => {
            if (debouncedOffersTimer) clearTimeout(debouncedOffersTimer);
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
                (isNew && status === TicketStatus.New) ||
                (inProgress && status === TicketStatus.InProgress) ||
                (closed && (status === TicketStatus.Resolved || status === TicketStatus.Failed))
            );
        });

        if (searchQuery && searchQuery.length > 0) {
            return filterJobs(copied, searchQuery);
        }

        return copied;
    });

    // filter based on search terms
    function filterJobs(jobs: TicketEvent[], searchTerm: string): TicketEvent[] {
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

    const { pending, success, lost } = $derived($offerFilter);

    const filteredOffers = $derived.by(() => {
        let copied = [...$allOffersOfUser];
        orderEventsChronologically(copied);

        copied = copied.filter((offer) => {
            const job = $appliedJobs?.find(
                (job) => job.ticketAddress === offer.referencedTicketAddress
            );

            const offerStatus = job
                ? job.acceptedOfferAddress
                    ? job.acceptedOfferAddress === offer.offerAddress
                        ? OfferStatus.Won
                        : OfferStatus.Lost
                    : OfferStatus.Pending
                : OfferStatus.Unknown;

            return (
                (pending && offerStatus === OfferStatus.Pending) ||
                (success && offerStatus === OfferStatus.Won) ||
                (lost && offerStatus === OfferStatus.Lost) ||
                offerStatus === OfferStatus.Unknown
            );
        });

        if (searchQuery && searchQuery.length > 0) {
            return filterOffers(copied, searchQuery);
        }

        return copied;
    });

    // filter based on search terms
    function filterOffers(offers: OfferEvent[], searchTerm: string): OfferEvent[] {
        const fuse = new Fuse(offers, {
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

        const filteredOfferList = searchResult.map(({ item }) => item);

        return filteredOfferList;
    }

    let initialized = $state(false);
    $effect(() => {
        if (pubkey && $sessionInitialized && !initialized) {
            initialized = true;
            allJobsFilter.authors = [pubkey];
            allOffersFilter.authors = [pubkey];

            allJobsOfUser.startSubscription();
            allOffersOfUser.startSubscription();
        }
    });

    let myJobsAndMyOffersElement = $state<HTMLDivElement>();
    $effect(() => {
        if (myJobsAndMyOffersElement && $scrollToMyJobsAndMyOffers) {
            $scrollToMyJobsAndMyOffers = false;
            setTimeout(() => {
                if (myJobsAndMyOffersElement) {
                    myJobsAndMyOffersElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }, 600)
        }
    });

    onDestroy(() => {
        if (allJobsOfUser) allJobsOfUser.empty();
        if (allOffersOfUser) allOffersOfUser.empty();
        if (appliedJobs) appliedJobs.empty();
        if (debouncedJobsTimer) clearTimeout(debouncedJobsTimer);
        if (debouncedOffersTimer) clearTimeout(debouncedOffersTimer);
    });

    let isOwnProfile = $derived($currentUser && $currentUser?.pubkey === pubkey);

    let tabs = $derived([
        { id: ProfilePageTabs.Jobs, label: `${isOwnProfile ? 'My' : ''} Jobs` },
        { id: ProfilePageTabs.Offers, label: `${isOwnProfile ? 'My' : ''} Offers` },
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
                        id="job-and-offers"
                        class="w-full flex flex-col gap-[15px] relative"
                        bind:this={myJobsAndMyOffersElement}
                    >
                        <div class="w-full flex flex-col gap-[10px]">
                            <TabSelector {tabs} bind:selectedTab={$profileTabStore} />
                            <div 
                                class="w-full flex flex-col"
                            >
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
                                                    <JobCard {job} showOffersDetail />
                                                {/each}
                                            </div>
                                            <!-- Pagination -->
                                        </div>
                                    </div>
                                {:else}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <Card classes="flex-row flex-wrap gap-[10px] p-[5px]">
                                            <Checkbox
                                                id="pending-offers"
                                                label="Pending"
                                                bind:checked={$offerFilter.pending}
                                            />
                                            <Checkbox
                                                id="success-offers"
                                                label="Success"
                                                bind:checked={$offerFilter.success}
                                            />
                                            <Checkbox
                                                id="lost-offers"
                                                label="Lost"
                                                bind:checked={$offerFilter.lost}
                                            />
                                        </Card>
                                        <div class="w-full flex flex-col gap-[15px]">
                                            <div class="w-full flex flex-col gap-[15px]">
                                                {#each filteredOffers as offer (offer.id)}
                                                    <OfferCard
                                                        {offer}
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
