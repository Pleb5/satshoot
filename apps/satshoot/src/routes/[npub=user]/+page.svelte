<script lang="ts">
    import { page } from '$app/stores';
    import NewOfferCard from '$lib/components/Cards/NewOfferCard.svelte';
    import NewUserCard from '$lib/components/Cards/NewUserCard.svelte';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import Checkbox from '$lib/components/UI/Inputs/Checkbox.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import currentUser from '$lib/stores/user';
    import { orderEventsChronologically } from '$lib/utils/helpers';
    import { NDKKind } from '@nostr-dev-kit/ndk';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy } from 'svelte';

    enum OfferStatus {
        Unknown,
        Pending,
        Won,
        Lost,
    }

    let jobFilter = {
        new: true,
        inProgress: false,
        closed: false,
    };

    let offerFilter = {
        pending: true,
        success: false,
        lost: false,
    };

    $: npub = $page.params.npub;
    $: user = $ndk.getUser({ npub: npub });

    const subOptions = {
        autoStart: true,
    };

    let allTicketsOfUser: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let allOffersOfUser: NDKEventStore<ExtendedBaseType<OfferEvent>>;
    let filteredTickets: ExtendedBaseType<ExtendedBaseType<TicketEvent>>[] = [];
    let filteredOffers: ExtendedBaseType<ExtendedBaseType<OfferEvent>>[] = [];

    // jobs on which use has made offers
    let appliedJobs: NDKEventStore<ExtendedBaseType<TicketEvent>>;

    $: if (user) {
        if (allTicketsOfUser) allTicketsOfUser.empty();
        if (allOffersOfUser) allOffersOfUser.empty();

        allTicketsOfUser = $ndk.storeSubscribe<TicketEvent>(
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

    $: {
        orderEventsChronologically($allTicketsOfUser);

        filteredTickets = $allTicketsOfUser.filter((ticket) => {
            const { new: isNew, inProgress, closed } = jobFilter;
            const { status } = ticket;

            return (
                (isNew && status === TicketStatus.New) ||
                (inProgress && status === TicketStatus.InProgress) ||
                (closed && (status === TicketStatus.Resolved || status === TicketStatus.Failed))
            );
        });
    }

    $: {
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

            const { pending, success, lost } = offerFilter;

            return (
                (pending && offerStatus === OfferStatus.Pending) ||
                (success && offerStatus === OfferStatus.Won) ||
                (lost && offerStatus === OfferStatus.Lost) ||
                offerStatus === OfferStatus.Unknown
            );
        });
    }

    onDestroy(() => {
        if (allTicketsOfUser) allTicketsOfUser.empty();
        if (allOffersOfUser) allOffersOfUser.empty();
        if (appliedJobs) appliedJobs.empty();
    });

    $: isOwnProfile = $currentUser && $currentUser?.pubkey === user.pubkey;

    $: tabs = [
        { id: ProfilePageTabs.Jobs, label: `${isOwnProfile ? 'My' : ''} Jobs` },
        { id: ProfilePageTabs.Offers, label: `${isOwnProfile ? 'My' : ''} Offers` },
    ];
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <!-- Section start -->
    <div class="w-full flex flex-col justify-center items-center py-[50px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col">
                    <NewUserCard {user} />
                    <div class="w-full flex flex-col gap-[15px] relative">
                        <div class="w-full flex flex-col gap-[10px]">
                            <TabSelector {tabs} bind:selectedTab={$profileTabStore} />
                            <div class="w-full flex flex-col">
                                {#if $profileTabStore === ProfilePageTabs.Jobs}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <div
                                            class="w-full flex flex-row gap-[10px] bg-white rounded-[6px] p-[5px] shadow-[0_0_4px_0_rgb(0,0,0,0.1)] flex-wrap"
                                        >
                                            <Checkbox
                                                id="new-jobs"
                                                label="New"
                                                bind:checked={jobFilter.new}
                                            />
                                            <Checkbox
                                                id="inProgress-jobs"
                                                label="In Progress"
                                                bind:checked={jobFilter.inProgress}
                                            />
                                            <Checkbox
                                                id="closed-jobs"
                                                label="Closed"
                                                bind:checked={jobFilter.closed}
                                            />
                                        </div>
                                        <div class="w-full flex flex-col gap-[15px]">
                                            <div
                                                class="w-full grid grid-cols-3 gap-[25px] max-[1200px]:grid-cols-2 max-[992px]:grid-cols-1 max-[768px]:grid-cols-1"
                                            >
                                                {#each filteredTickets as ticket (ticket.id)}
                                                    <JobCard {ticket} />
                                                {/each}
                                            </div>
                                            <!-- Pagination -->
                                        </div>
                                    </div>
                                {:else}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <div
                                            class="w-full flex flex-row gap-[10px] bg-white rounded-[6px] p-[5px] shadow-[0_0_4px_0_rgb(0,0,0,0.1)] flex-wrap"
                                        >
                                            <Checkbox
                                                id="pending-offers"
                                                label="Pending"
                                                bind:checked={offerFilter.pending}
                                            />
                                            <Checkbox
                                                id="success-offers"
                                                label="Success"
                                                bind:checked={offerFilter.success}
                                            />
                                            <Checkbox
                                                id="lost-offers"
                                                label="Lost"
                                                bind:checked={offerFilter.lost}
                                            />
                                        </div>
                                        <div class="w-full flex flex-col gap-[15px]">
                                            <div class="w-full flex flex-col gap-[15px]">
                                                {#each filteredOffers as offer (offer.id)}
                                                    <NewOfferCard
                                                        {offer}
                                                        skipUserProfile
                                                        skipReputation
                                                        viewJob
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
