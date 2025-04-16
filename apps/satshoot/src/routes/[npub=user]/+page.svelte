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

    enum OfferStatus {
        Unknown,
        Pending,
        Won,
        Lost,
    }

    let searchQuery = $derived(page.url.searchParams.get('searchTerms'));
    let filterList = $derived(searchQuery ? searchQuery.split(',') : []);
    let npub = page.params.npub;
    let pubkey = nip19.decode(npub).data as string;
    let user = $ndk.getUser({ npub: npub });

    const subOptions:NDKSubscribeOptions = {
        autoStart: false,
    };

    const allJobsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceTicket],
    }
    const allJobsOfUser = $ndk.storeSubscribe<TicketEvent>(
        allJobsFilter,
        subOptions,
        TicketEvent
    );

    const allOffersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOffer],
    }
    const allOffersOfUser = $ndk.storeSubscribe<OfferEvent>(
        allOffersFilter,
        subOptions,
        OfferEvent
    );

    const dTagOfJobs = $derived($allOffersOfUser.map(
        (offer) => offer.referencedTicketAddress.split(':')[2]
    ));

    // jobs on which user has made offers
    const appliedJobsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceTicket],
    }
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

    $effect(debounce(() => {
        if (dTagOfJobs.length > 0) {
            appliedJobs.subscription?.stop();
            appliedJobsFilter['#d'] = dTagOfJobs;
            appliedJobs.startSubscription();
        }
    }, 800));
    
    const { new: isNew, inProgress, closed } = $derived($jobFilter);
    const filteredJobs = $derived.by(() => {
        let copied = [...$allJobsOfUser];
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

        return filterJobs(copied);
    })

    // filter based on search terms
    function filterJobs(jobs: TicketEvent[]): TicketEvent[] {
        return jobs.filter((job) => {
            const lowerCaseTitle = job.title.toLowerCase();
            const lowerCaseDescription = job.description.toLowerCase();

            if (filterList.length === 0) return true;

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


    const { pending, success, lost } = $derived($offerFilter);
    const filteredOffers = $derived.by(() => {
        let copied = [...$allOffersOfUser]
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

        return filterOffers(copied);
    })

    // filter based on search terms
    function filterOffers(offers: OfferEvent[]): OfferEvent[] {
        return offers.filter((offer) => {
            const lowerCaseDescription = offer.description.toLowerCase();

            if (filterList.length === 0) return true;

            // Check if the job matches any filter
            const matchesFilter = filterList.some((filter: string) => {
                const lowerCaseFilter = filter.toLowerCase();

                const descContains = lowerCaseDescription.includes(lowerCaseFilter);

                return descContains;
            });

            return matchesFilter;
        });
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

    let isOwnProfile = $derived($currentUser && $currentUser?.pubkey === pubkey);

    let tabs = $derived([
        { id: ProfilePageTabs.Jobs, label: `${isOwnProfile ? 'My' : ''} Jobs` },
        { id: ProfilePageTabs.Offers, label: `${isOwnProfile ? 'My' : ''} Offers` },
    ]);
</script>

<div class="w-full flex flex-col gap-0 grow">
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
