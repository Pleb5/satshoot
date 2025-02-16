<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { wot } from '$lib/stores/wot';
    import {
        clientReviews,
        freelancerReviews,
        aggregateClientRatings,
        aggregateFreelancerRatings,
    } from '$lib/stores/reviews';

    import { ReviewType } from '$lib/events/ReviewEvent';
    import { type RatingConsensus, averageToRatingText } from '$lib/utils/helpers';

    import { insertThousandSeparator } from '$lib/utils/misc';
    import { NDKNutzap, zapInvoiceFromEvent } from '@nostr-dev-kit/ndk';
    import { NDKEvent, NDKKind, type Hexpubkey } from '@nostr-dev-kit/ndk';

    import currentUser from '$lib/stores/user';

    import drawerID, { DrawerIDs } from '$lib/stores/drawer';
    import { type DrawerSettings, getDrawerStore } from '@skeletonlabs/skeleton';
    import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { wotUpdating } from '$lib/stores/wot';
    import type { NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { SatShootPubkey } from '$lib/utils/misc';
    import { onDestroy } from 'svelte';
    import { wotFilteredOffers, wotFilteredTickets } from '$lib/stores/freelance-eventstores';
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import type { OfferEvent } from '$lib/events/OfferEvent';

    export let user: Hexpubkey;
    export let type: ReviewType | undefined;
    let reviewType: ReviewType;
    export let open = true;

    const drawerStore = getDrawerStore();

    $: reviewArraysExist = $clientReviews && $freelancerReviews;
    $: reviewsExist = reviewArraysExist
            && ($clientReviews.length > 0 || $freelancerReviews.length > 0);

    $: if (!type && reviewArraysExist) {
        if ($clientReviews.length > $freelancerReviews.length) {
            reviewType = ReviewType.Client;
        } else {
            reviewType = ReviewType.Freelancer;
        }
    } else if (type) {
        reviewType = type;
    }

    const subOptions = {
        closeOnEose: false,
        groupable: true,
        groupableDelay: 1500,
        autoStart: true,
    };

    let allEarningsStore: NDKEventStore<NDKEvent>;
    let allPaymentsStore: NDKEventStore<NDKEvent>;
    let allPledgesStore: NDKEventStore<NDKEvent>;

    let needSetup = true;

    let allEarnings = 0;
    let allPayments = 0;
    let allPledges = 0;

    // Get all winner offer a-tags OF this user as a freelancer
    // We take only those that were on tickets from a client in wot
    const allWinnerOffersOfUser: string[] = [];

    // Get all winner offer a-tags FOR this user as a client
    // We take only freelancers in wot
    const allWinnerOffersForUser: string[] = [];

    // Get all tickets where user won and client is in wot
    // OR tickets where user is a client and winner freelancer is in wot
    const allTicketsWhereUserInvolved: string[] = [];

    const baseClasses = 'card p-4 bg-surface-300-600-token';

    let ratingConsensus = '?';
    let ratingColor = '';

    function showReviewBreakdown() {
        $drawerID = DrawerIDs.ReviewBreakdown;
        const drawerSettings: DrawerSettings = {
            id: $drawerID.toString(),
            meta: { reviewType: reviewType, user: user },
            position: 'top',
            height: 'h-[70vh]',
            bgDrawer: 'bg-surface-300-600-token',
        };

        drawerStore.open(drawerSettings);
    }

    $: if ($currentUser && user && $clientReviews && $freelancerReviews) {
        let clientAverage = aggregateClientRatings(user).average;
        let freelancerAverage = aggregateFreelancerRatings(user).average;
        let overallAverage: number = NaN;

        if (reviewType === ReviewType.Client) {
            overallAverage = clientAverage;
        } else if (reviewType === ReviewType.Freelancer) {
            overallAverage = freelancerAverage;
        } else if (type === undefined) {
            if (!isNaN(clientAverage) && !isNaN(freelancerAverage)) {
                overallAverage = (clientAverage + freelancerAverage) / 2;
            } else if (isNaN(clientAverage) && !isNaN(freelancerAverage)) {
                overallAverage = freelancerAverage;
            } else if (isNaN(freelancerAverage) && !isNaN(clientAverage)) {
                overallAverage = clientAverage;
            } else {
                overallAverage = NaN;
            }
        }

        const ratingText: RatingConsensus = averageToRatingText(overallAverage);
        ratingConsensus = ratingText.ratingConsensus;
        ratingColor = ratingText.ratingColor;
    }

    $: if ($currentUser && needSetup && user && $wot
        && $wotFilteredTickets && $wotFilteredOffers) {
        needSetup = true;

        const allTicketsOfUser = $wotFilteredTickets.filter(
            (ticket: TicketEvent) => ticket.pubkey === user
        );

        const allOffersOfUser = $wotFilteredOffers.filter(
            (offer: OfferEvent) => offer.pubkey === user
        );

        $wotFilteredTickets.forEach((t: TicketEvent) => {
            allOffersOfUser.forEach((o: OfferEvent) => {
                if (t.acceptedOfferAddress === o.offerAddress) {
                    allWinnerOffersOfUser.push(o.id);
                    allTicketsWhereUserInvolved.push(t.ticketAddress);
                }
            });
        });

        $wotFilteredOffers.forEach((o: OfferEvent) => {
            allTicketsOfUser.forEach((t: TicketEvent) => {
                if (t.acceptedOfferAddress === o.offerAddress) {
                    allWinnerOffersForUser.push(o.id);
                    allTicketsWhereUserInvolved.push(t.ticketAddress);
                }
            });
        });

        allEarningsStore = $ndk.storeSubscribe(
            { 
                kinds: [NDKKind.Zap, NDKKind.Nutzap], 
                '#p': [user],
                '#e': allWinnerOffersOfUser
            },
            subOptions
        );

        allPaymentsStore = $ndk.storeSubscribe(
            { kinds: [NDKKind.Zap, NDKKind.Nutzap], '#e': allWinnerOffersForUser },
            subOptions
        );

        allPledgesStore = $ndk.storeSubscribe(
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#a': allTicketsWhereUserInvolved,
                '#p': [SatShootPubkey],
            },
            subOptions
        );
    }

    $: if ($allEarningsStore) {
        allEarnings = 0;
        $allEarningsStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice && zapInvoice.amount) {
                    allEarnings += Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap && nutzap.amount) {
                    allEarnings += Math.round(nutzap.amount / 1000);
                }
            }
        });
    }

    $: if ($allPaymentsStore) {
        allPayments = 0;
        $allPaymentsStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice && zapInvoice.amount) {
                    allPayments += Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap && nutzap.amount) {
                    allPayments += Math.round(nutzap.amount / 1000);
                }
            }
        });
    }

    $: if ($allPledgesStore) {
        allPledges = 0;

        // Helper function to calculate pledge share
        function calculateUserShare(pledgeSum: number, ticket: TicketEvent, offer: OfferEvent) {
            const absolutePledgeSplit = Math.round((offer.pledgeSplit / 100) * pledgeSum);
            let userShare = 0;

            if (ticket.pubkey === user) {
                // User is the client
                userShare = pledgeSum - absolutePledgeSplit;
            } else {
                // User is the freelancer
                userShare = absolutePledgeSplit;
            }

            return userShare;
        }

        // Helper function to find the ticket and offer
        function getTicketAndOffer(zap: NDKEvent) {
            const ticket = $wotFilteredTickets
                .filter((t: TicketEvent) => t.ticketAddress === zap.tagValue('a'))
                .at(0) as TicketEvent;

            const offer = $wotFilteredOffers
                .filter((o: OfferEvent) => o.offerAddress === ticket.acceptedOfferAddress)
                .at(0) as OfferEvent;

            return { ticket, offer };
        }

        // Main loop to process each pledge event
        $allPledgesStore.forEach((zap: NDKEvent) => {
            let pledgeSum = 0;

            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice && zapInvoice.amount) {
                    pledgeSum = Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap && nutzap.amount) {
                    pledgeSum = Math.round(nutzap.amount / 1000);
                }
            }

            if (pledgeSum > 0) {
                const { ticket, offer } = getTicketAndOffer(zap);

                if (ticket && offer) {
                    const userShare = calculateUserShare(pledgeSum, ticket, offer);
                    allPledges += userShare;
                }
            }
        });
    }

    onDestroy(() => {
        if (allEarningsStore) allEarningsStore.empty();
        if (allPaymentsStore) allPaymentsStore.empty();
        if (allPledgesStore) allPledgesStore.empty();
    });
</script>

<Accordion class={baseClasses}>
    <AccordionItem bind:open>
        <svelte:fragment slot="lead">
            <i class="fa-solid text-2xl text-warning-500 fa-handshake-simple"></i>
        </svelte:fragment>
        <svelte:fragment slot="summary">
            <div class="flex items-center justify-center">
                <h3 class="h4 sm:h3 text-center">User Reputation</h3>
            </div>
        </svelte:fragment>
        <svelte:fragment slot="content">
            {#if user && reviewArraysExist && $allEarningsStore 
                && $allPaymentsStore && $allPledgesStore}
                <div
                    class="flex flex-grow justify-center sm:justify-between flex-wrap gap-y-2 gap-x-4"
                >
                    <div class="flex gap-x-2">
                        <div class="flex flex-col items-center gap-y-2">
                            <div class="flex items-center">
                                <h5 class="h5 sm:h4 underline">Ratings</h5>
                                {#if reviewsExist}
                                    <button
                                        type="button"
                                        class="btn btn-icon text-start text-primary-400-500-token"
                                        on:click={showReviewBreakdown}
                                    >
                                        <span>
                                            <i class="fa-solid fa-arrow-up-right-from-square"> </i>
                                        </span>
                                    </button>
                                {/if}
                            </div>
                            {#if $wotUpdating}
                                <ProgressRadial
                                    value={undefined}
                                    stroke={60}
                                    meter="stroke-primary-500"
                                    track="stroke-primary-500/30"
                                    strokeLinecap="round"
                                    width="w-8"
                                />
                            {:else}
                                <div class="badge px-4 py-2 {ratingColor}">
                                    {ratingConsensus}
                                </div>
                            {/if}
                        </div>
                    </div>
                    <!-- Earnings -->
                    <div class="flex items-center">
                        <div class="flex flex-col items-center gap-y-2">
                            <h5 class="h5 sm:h4 underline">
                                <span class="text-warning-500">
                                    <i class="fa-solid fa-bolt"></i>
                                </span>
                                <span>All Earnings</span>
                            </h5>
                            <div>
                                <span>
                                    {insertThousandSeparator(allEarnings) + ' sats'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <!-- Payments -->
                    <div class="flex items-center">
                        <div class="flex flex-col items-center gap-y-2">
                            <h5 class="h5 sm:h4 underline">
                                <span class="text-warning-500">
                                    <i class="fa-solid fa-bolt"></i>
                                </span>
                                <span>All Payments</span>
                            </h5>
                            <div>
                                <span>
                                    {insertThousandSeparator(allPayments) + ' sats'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <div class="flex flex-col items-center gap-y-2">
                            <h5 class="h5 sm:h4 underline">
                                <span class="text-warning-500">
                                    <i class="fa-solid fa-bolt"></i>
                                </span>
                                <span>All Pledges</span>
                            </h5>
                            <div>
                                <span>
                                    {insertThousandSeparator(allPledges) + ' sats'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            {:else}
                <div class="grid grid-cols-[1fr_1fr_1fr] gap-8 items-center">
                    <div class="placeholder animate-pulse" />
                    <div class="placeholder animate-pulse" />
                    <div class="placeholder animate-pulse" />
                </div>
            {/if}
        </svelte:fragment>
    </AccordionItem>
</Accordion>
