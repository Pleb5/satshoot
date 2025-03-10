<script lang="ts">
    import { page } from '$app/stores';
    import OfferCard from '$lib/components/Cards/OfferCard.svelte';
    import UserCard from '$lib/components/Cards/UserCard.svelte';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Checkbox from '$lib/components/UI/Inputs/Checkbox.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import { jobFilter, offerFilter, scrollToMyJobsAndMyOffers } from '$lib/stores/gui';
    import ndk from '$lib/stores/ndk';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import currentUser from '$lib/stores/user';
    import { orderEventsChronologically } from '$lib/utils/helpers';
    import { NDKKind, type NDKTag } from '@nostr-dev-kit/ndk';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy, onMount } from 'svelte';

    enum OfferStatus {
        Unknown,
        Pending,
        Won,
        Lost,
    }

    $: searchQuery = $page.url.searchParams.get('searchTerms');
    $: filterList = searchQuery ? searchQuery.split(',') : [];
    $: npub = $page.params.npub;
    $: user = $ndk.getUser({ npub: npub });

    const subOptions = {
        autoStart: true,
    };

    let allJobsOfUser: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let allOffersOfUser: NDKEventStore<ExtendedBaseType<OfferEvent>>;
    let filteredJobs: ExtendedBaseType<ExtendedBaseType<TicketEvent>>[] = [];
    let filteredOffers: ExtendedBaseType<ExtendedBaseType<OfferEvent>>[] = [];

    // jobs on which use has made offers
    let appliedJobs: NDKEventStore<ExtendedBaseType<TicketEvent>>;

    $: if (user) {
        if (allJobsOfUser) allJobsOfUser.empty();
        if (allOffersOfUser) allOffersOfUser.empty();

        allJobsOfUser = $ndk.storeSubscribe<TicketEvent>(
            {
                kinds: [NDKKind.FreelanceTicket],
                authors: [user.pubkey],
            },
            subOptions,
            TicketEvent
        );

        allOffersOfUser = $ndk.storeSubscribe<OfferEvent>(
            {
                kinds: [NDKKind.FreelanceOffer],
                authors: [user.pubkey],
            },
            subOptions,
            OfferEvent
        );
    }

    $: if ($allOffersOfUser.length > 0) {
        const dTagOfJobs = $allOffersOfUser.map(
            (offer) => offer.referencedTicketAddress.split(':')[2]
        );

        appliedJobs = $ndk.storeSubscribe<TicketEvent>(
            {
                kinds: [NDKKind.FreelanceTicket],
                '#d': dTagOfJobs,
            },
            {
                autoStart: true,
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1000,
            },
            TicketEvent
        );
    }

    $: if ($allJobsOfUser && filterList) {
        orderEventsChronologically($allJobsOfUser);

        // filter based on status
        filteredJobs = $allJobsOfUser.filter((job) => {
            const { new: isNew, inProgress, closed } = $jobFilter;
            const { status } = job;

            return (
                (isNew && status === TicketStatus.New) ||
                (inProgress && status === TicketStatus.InProgress) ||
                (closed && (status === TicketStatus.Resolved || status === TicketStatus.Failed))
            );
        });

        filterJobs();
    }

    $: if ($allOffersOfUser && filterList) {
        orderEventsChronologically($allOffersOfUser);

        filteredOffers = $allOffersOfUser.filter((offer) => {
            const job = $appliedJobs.find(
                (job) => job.ticketAddress === offer.referencedTicketAddress
            );

            const offerStatus = job
                ? job.acceptedOfferAddress
                    ? job.acceptedOfferAddress === offer.offerAddress
                        ? OfferStatus.Won
                        : OfferStatus.Lost
                    : OfferStatus.Pending
                : OfferStatus.Unknown;

            const { pending, success, lost } = $offerFilter;

            return (
                (pending && offerStatus === OfferStatus.Pending) ||
                (success && offerStatus === OfferStatus.Won) ||
                (lost && offerStatus === OfferStatus.Lost) ||
                offerStatus === OfferStatus.Unknown
            );
        });

        filterOffers();
    }

    let myJobsAndMyOffersElement: HTMLDivElement;
    onMount(() => {
        if (myJobsAndMyOffersElement && $scrollToMyJobsAndMyOffers) {
            $scrollToMyJobsAndMyOffers = false;
            myJobsAndMyOffersElement.scrollIntoView(true);
        }
    });

    onDestroy(() => {
        if (allJobsOfUser) allJobsOfUser.empty();
        if (allOffersOfUser) allOffersOfUser.empty();
        if (appliedJobs) appliedJobs.empty();
    });

    // filter based on search terms
    function filterJobs() {
        // We need to check all jobs against all filters
        if (filterList.length > 0) {
            filteredJobs = filteredJobs.filter((job) => {
                const lowerCaseTitle = job.title.toLowerCase();
                const lowerCaseDescription = job.description.toLowerCase();

                // Check if the job matches any filter
                const matchesFilter = filterList.some((filter: string) => {
                    const lowerCaseFilter = filter.toLowerCase();

                    // Check title and description and tags
                    const titleContains = lowerCaseTitle.includes(lowerCaseFilter);
                    const descContains = lowerCaseDescription.includes(lowerCaseFilter);
                    const tagsContain = job.tags.some((tag: NDKTag) =>
                        (tag[1] as string).toLowerCase().includes(lowerCaseFilter)
                    );

                    return titleContains || descContains || tagsContain;
                });

                return matchesFilter;
            });
        }
    }

    // filter based on search terms
    function filterOffers() {
        // We need to check all jobs against all filters
        if (filterList.length > 0) {
            filteredOffers = filteredOffers.filter((offer) => {
                const lowerCaseDescription = offer.description.toLowerCase();

                // Check if the job matches any filter
                const matchesFilter = filterList.some((filter: string) => {
                    const lowerCaseFilter = filter.toLowerCase();

                    const descContains = lowerCaseDescription.includes(lowerCaseFilter);

                    return descContains;
                });

                return matchesFilter;
            });
        }
    }

    $: isOwnProfile = $currentUser && $currentUser?.pubkey === user.pubkey;

    $: tabs = [
        { id: ProfilePageTabs.Jobs, label: `${isOwnProfile ? 'My' : ''} Jobs` },
        { id: ProfilePageTabs.Offers, label: `${isOwnProfile ? 'My' : ''} Offers` },
    ];
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <!-- Section start -->
    <div class="w-full flex flex-col justify-center items-center pb-[50px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col">
                    <UserCard {user} />
                    <div
                        id="job-and-offers"
                        class="w-full flex flex-col gap-[15px] relative"
                        bind:this={myJobsAndMyOffersElement}
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
