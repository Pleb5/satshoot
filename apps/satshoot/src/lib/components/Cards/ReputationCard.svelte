<script lang="ts">
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { wotFilteredOffers, wotFilteredTickets } from '$lib/stores/freelance-eventstores';
    import ndk from '$lib/stores/ndk';
    import {
        aggregateClientRatings,
        aggregateFreelancerRatings,
        clientReviews,
        freelancerReviews,
    } from '$lib/stores/reviews';
    import currentUser from '$lib/stores/user';
    import { wot } from '$lib/stores/wot';
    import { averageToRatingText, type RatingConsensus } from '$lib/utils/helpers';
    import { insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';
    import {
        NDKKind,
        NDKNutzap,
        zapInvoiceFromEvent,
        type Hexpubkey,
        type NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import type { NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy } from 'svelte';
    import ReviewSummaryAsFreelancer from '../Modals/ReviewSummaryAsFreelancer.svelte';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import ReviewSummaryAsClient from '../Modals/ReviewSummaryAsClient.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const modalStore = getModalStore();

    export let user: Hexpubkey;
    export let type: ReviewType | undefined = undefined;
    export let forUserCard: boolean = false;

    let reviewType: ReviewType;

    $: reviewArraysExist = $clientReviews && $freelancerReviews;
    $: reviewsExist =
        reviewArraysExist && ($clientReviews.length > 0 || $freelancerReviews.length > 0);

    $: if (type) {
        reviewType = type;
    } else if (reviewArraysExist) {
        if ($clientReviews.length > $freelancerReviews.length) {
            reviewType = ReviewType.Client;
        } else {
            reviewType = ReviewType.Freelancer;
        }
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

    let allEarnings = 0;
    let allPayments = 0;
    let allPledges = 0;

    let ratingConsensus = '?';
    let asClientRatingConsensus = '?';
    let asFreelancerRatingConsensus = '?';
    let ratingColor = '';

    // Get all winner offer a-tags OF this user as a freelancer
    // We take only those that were on tickets from a client in wot
    const allWinnerOffersOfUser: string[] = [];

    // Get all winner offer a-tags FOR this user as a client
    // We take only freelancers in wot
    const allWinnerOffersForUser: string[] = [];

    // Get all tickets where user won and client is in wot
    // OR tickets where user is a client and winner freelancer is in wot
    const allTicketsWhereUserInvolved: string[] = [];

    let needSetup = true;

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

        asClientRatingConsensus = averageToRatingText(clientAverage).ratingConsensus;
        asFreelancerRatingConsensus = averageToRatingText(freelancerAverage).ratingConsensus;
    }

    $: if ($currentUser && needSetup && user && $wot && $wotFilteredTickets && $wotFilteredOffers) {
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
                '#e': allWinnerOffersOfUser,
            },
            subOptions
        );
        asFreelancerRatingConsensus;

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

    function showFreelancerReviewBreakdown() {
        console.log('modalStore :>> ', modalStore);

        const modalComponent: ModalComponent = {
            ref: ReviewSummaryAsFreelancer,
            props: { userHex: user },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    function showClientReviewBreakdown() {
        console.log('modalStore :>> ', modalStore);

        const modalComponent: ModalComponent = {
            ref: ReviewSummaryAsClient,
            props: { userHex: user },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    const reputationBlockWrapperClasses =
        'transition ease duration-[0.3s] flex flex-col cursor-pointer w-full gap-[5px] hover:text-white ' +
        'p-[10px] rounded-[4px] hover:bg-blue-500 hover:shadow-[0_0_8px_rgb(0,0,0,0.25)] group';

    const satsWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row flex-wrap gap-[10px] justify-between ' +
        'items-center rounded-[4px] px-[10px] py-[5px] hover:bg-blue-500 group';

    const boltIconWrapperClasses =
        'flex flex-row gap-[5px] items-center flex-wrap grow-[1] group-hover:border-r-[1px] ' +
        'group-hover:border-r-white-200 group-hover:text-white';
</script>

{#if !forUserCard}
    <div class="w-full flex flex-row flex-wrap items-center gap-[10px] px-[5px]">
        {#if reviewType === ReviewType.Freelancer}
            <Button
                variant="outlined"
                classes="justify-start"
                grow
                on:click={showFreelancerReviewBreakdown}
            >
                <p class="font-[500]">
                    Freelancer Reputation:
                    <span class="badge px-4 {ratingColor}">
                        {asFreelancerRatingConsensus}
                    </span>
                </p>
            </Button>
            <div class="flex flex-row grow-[1] px-[20px]">
                <p class="font-[500]">
                    Total Earnings:
                    <span class="font-[300]">
                        {insertThousandSeparator(allEarnings) + ' sats'}
                    </span>
                </p>
            </div>
        {/if}

        {#if reviewType === ReviewType.Client}
            <Button
                variant="outlined"
                classes="justify-start"
                grow
                on:click={showClientReviewBreakdown}
            >
                <p class="font-[500]">
                    Client Reputation:
                    <span class="badge px-4 {ratingColor}">
                        {asClientRatingConsensus}
                    </span>
                </p>
            </Button>
            <div class="flex flex-row grow-[1] px-[20px]">
                <p class="font-[500]">
                    Total Earnings:
                    <span class="font-[300]">
                        {insertThousandSeparator(allPayments) + ' sats'}
                    </span>
                </p>
            </div>
        {/if}

        <div class="flex flex-row grow-[1] px-[20px]">
            <p class="font-[500]">
                Total Pledges:
                <span class="font-[300]"> {insertThousandSeparator(allPledges) + ' sats'} </span>
            </p>
        </div>
    </div>
{/if}

{#if forUserCard}
    <Card classes="gap-[15px]">
        <div class="w-full flex flex-col gap-[15px]">
            <div class="w-full flex flex-col gap-[10px]">
                <p class="w-full font-[600] pl-[5px]">User's Overall Reputation</p>
                <div
                    class="w-full flex flex-row justify-center items-center gap-[5px] p-[5px] rounded-[4px] bg-black-100 border-[1px] border-black-100"
                >
                    <i
                        class="bx bxs-star border-r-[1px] border-r-black-100 text-black-500 pr-[5px]"
                    />
                    <p class="font-[700] grow-[1]">{ratingConsensus}</p>
                </div>
                <div
                    class="w-full flex flex-col gap-[10px] border-[1px] border-black-100 p-[10px] rounded-[4px] max-[768px]:flex-col"
                >
                    <button
                        class={reputationBlockWrapperClasses}
                        on:click={showFreelancerReviewBreakdown}
                    >
                        <p class="w-full text-start font-[600] pl-[5px]">As a freelancer</p>
                        <div
                            class="w-full flex flex-row justify-center items-center gap-[5px] p-[5px] rounded-[4px] bg-black-100 border-[1px] border-black-100"
                        >
                            <i
                                class="bx bxs-star transition ease duration-[0.3s] border-r-[1px] border-r-black-100 text-black-500 pr-[5px] group-hover:text-white"
                            />
                            <p class="font-[700] grow-[1]">{asFreelancerRatingConsensus}</p>
                        </div>
                    </button>
                    <button
                        class={reputationBlockWrapperClasses}
                        on:click={showClientReviewBreakdown}
                    >
                        <p class="w-full text-start font-[600] pl-[5px]">As a client</p>
                        <div
                            class="w-full flex flex-row justify-center items-center gap-[5px] p-[5px] rounded-[4px] bg-black-100 border-[1px] border-black-100"
                        >
                            <i
                                class="bx bxs-star transition ease duration-[0.3s] border-r-[1px] border-r-black-100 text-black-500 pr-[5px] group-hover:text-white"
                            />
                            <p class="font-[700] grow-[1]">{asClientRatingConsensus}</p>
                        </div>
                    </button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[5px] rounded-[5px] p-[10px] border-[1px] border-black-200"
            >
                <div
                    title="The total amount of money this user has received for completing jobs"
                    class={satsWrapperClasses}
                >
                    <p class="group {boltIconWrapperClasses}">
                        <i
                            class="bx bxsatsWrapperClassess-bolt text-black-500 group-hover:text-yellow-200"
                        />
                        Total earnings
                    </p>
                    <p class="group-hover:text-white">
                        {insertThousandSeparator(allEarnings) + ' sats'}
                    </p>
                </div>
                <div
                    title="The total amount of money this user has paid freelancers that completed their jobs"
                    class={satsWrapperClasses}
                >
                    <p class={boltIconWrapperClasses}>
                        <i class="bx bxs-bolt text-black-500 group-hover:text-yellow-200" />
                        Total payments
                    </p>
                    <p class="group-hover:text-white">
                        {insertThousandSeparator(allPayments) + ' sats'}
                    </p>
                </div>
                <div
                    title="The total amount of money this user has donated to help the development & maintenance of SatShoot"
                    class={satsWrapperClasses}
                >
                    <p class={boltIconWrapperClasses}>
                        <i class="bx bxs-bolt text-black-500 group-hover:text-yellow-200" />
                        Total pledges
                    </p>
                    <p class="group-hover:text-white">
                        {insertThousandSeparator(allPledges) + ' sats'}
                    </p>
                </div>
            </div>
        </div>
    </Card>
{/if}
