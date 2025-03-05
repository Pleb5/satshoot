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
    import { abbreviateNumber, insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';
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
    import ReviewSummaryAsClient from '../Modals/ReviewSummaryAsClient.svelte';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import RatingBlock from '../UI/Display/RatingBlock.svelte';

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
        reviewType =
            $clientReviews.length > $freelancerReviews.length
                ? ReviewType.Client
                : ReviewType.Freelancer;
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
    let asClientRatingColor = '';
    let asFreelancerRatingColor = '';

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
        const clientAverage = aggregateClientRatings(user).average;
        const freelancerAverage = aggregateFreelancerRatings(user).average;
        let overallAverage: number = NaN;

        if (reviewType === ReviewType.Client) {
            overallAverage = clientAverage;
        } else if (reviewType === ReviewType.Freelancer) {
            overallAverage = freelancerAverage;
        } else if (type === undefined) {
            overallAverage = calculateOverallAverage(clientAverage, freelancerAverage);
        }

        const ratingText: RatingConsensus = averageToRatingText(overallAverage);
        ratingConsensus = ratingText.ratingConsensus;
        ratingColor = ratingText.ratingColor;

        const asClientRating = averageToRatingText(clientAverage);
        const asFreelancerRating = averageToRatingText(freelancerAverage);

        asClientRatingConsensus = asClientRating.ratingConsensus;
        asFreelancerRatingConsensus = asFreelancerRating.ratingConsensus;
        asClientRatingColor = asClientRating.ratingColor;
        asFreelancerRatingColor = asFreelancerRating.ratingColor;
    }

    function calculateOverallAverage(clientAverage: number, freelancerAverage: number): number {
        if (!isNaN(clientAverage) && !isNaN(freelancerAverage)) {
            return (clientAverage + freelancerAverage) / 2;
        } else if (isNaN(clientAverage) && !isNaN(freelancerAverage)) {
            return freelancerAverage;
        } else if (isNaN(freelancerAverage) && !isNaN(clientAverage)) {
            return clientAverage;
        } else {
            return NaN;
        }
    }

    $: if ($currentUser && needSetup && user && $wot && $wotFilteredTickets && $wotFilteredOffers) {
        needSetup = false;

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
            { kinds: [NDKKind.Zap, NDKKind.Nutzap], '#p': [user], '#e': allWinnerOffersOfUser },
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
        allEarnings = calculateTotalAmount($allEarningsStore);
    }

    $: if ($allPaymentsStore) {
        allPayments = calculateTotalAmount($allPaymentsStore);
    }

    $: if ($allPledgesStore) {
        allPledges = calculatePledges(
            $allPledgesStore,
            $wotFilteredTickets,
            $wotFilteredOffers,
            user
        );
    }

    function calculateTotalAmount(events: NDKEvent[]): number {
        return events.reduce((total, zap) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice?.amount) {
                    return total + Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap?.amount) {
                    return total + Math.round(nutzap.amount / 1000);
                }
            }
            return total;
        }, 0);
    }

    /**
     * Calculates the total pledges for a user by processing a list of NDK events (zaps or nutzaps).
     * It sums up the user's share of pledges based on their role (client or freelancer) in the associated tickets and offers.
     *
     * @param events - An array of NDKEvent objects representing zaps or nutzaps.
     * @param tickets - An array of TicketEvent objects representing tickets.
     * @param offers - An array of OfferEvent objects representing offers.
     * @param user - The hexpubkey of the user for whom the pledges are being calculated.
     * @returns The total amount of pledges (in sats) that the user is entitled to.
     */
    function calculatePledges(
        events: NDKEvent[],
        tickets: TicketEvent[],
        offers: OfferEvent[],
        user: Hexpubkey
    ): number {
        return events.reduce((total, zap) => {
            // Calculate the total amount of the zap/nutzap in sats
            const pledgeSum = calculatePledgeSum(zap);
            if (pledgeSum > 0) {
                // Find the associated ticket and offer for the zap/nutzap
                const { ticket, offer } = getTicketAndOffer(zap, tickets, offers);
                if (ticket && offer) {
                    // Calculate the user's share of the pledge based on their role
                    const userShare = calculateUserShare(pledgeSum, ticket, offer, user);
                    return total + userShare;
                }
            }
            return total;
        }, 0);
    }

    /**
     * Calculates the total amount of a zap or nutzap event in sats.
     *
     * @param zap - An NDKEvent object representing a zap or nutzap.
     * @returns The amount of the zap/nutzap in sats, or 0 if the amount is invalid or the event is not a zap/nutzap.
     */
    function calculatePledgeSum(zap: NDKEvent): number {
        if (zap.kind === NDKKind.Zap) {
            // Extract the zap invoice and return the amount in sats
            const zapInvoice = zapInvoiceFromEvent(zap);
            return zapInvoice?.amount ? Math.round(zapInvoice.amount / 1000) : 0;
        } else if (zap.kind === NDKKind.Nutzap) {
            // Extract the nutzap and return the amount in sats
            const nutzap = NDKNutzap.from(zap);
            return nutzap?.amount ? Math.round(nutzap.amount / 1000) : 0;
        }
        return 0;
    }

    /**
     * Finds the ticket and offer associated with a zap/nutzap event.
     *
     * @param zap - An NDKEvent object representing a zap or nutzap.
     * @param tickets - An array of TicketEvent objects representing tickets.
     * @param offers - An array of OfferEvent objects representing offers.
     * @returns An object containing the associated ticket and offer, or undefined if not found.
     */
    function getTicketAndOffer(
        zap: NDKEvent,
        tickets: TicketEvent[],
        offers: OfferEvent[]
    ): { ticket: TicketEvent | undefined; offer: OfferEvent | undefined } {
        // Find the ticket associated with the zap/nutzap using the 'a' tag
        const ticket = tickets.find((t) => t.ticketAddress === zap.tagValue('a'));
        // Find the offer associated with the ticket's accepted offer address
        const offer = offers.find((o) => o.offerAddress === ticket?.acceptedOfferAddress);
        return { ticket, offer };
    }

    /**
     * Calculates the user's share of a pledge based on their role (client or freelancer).
     *
     * @param pledgeSum - The total amount of the pledge in sats.
     * @param ticket - The TicketEvent object associated with the pledge.
     * @param offer - The OfferEvent object associated with the pledge.
     * @param user - The hexpubkey of the user for whom the share is being calculated.
     * @returns The user's share of the pledge in sats.
     */
    function calculateUserShare(
        pledgeSum: number,
        ticket: TicketEvent,
        offer: OfferEvent,
        user: Hexpubkey
    ): number {
        // Calculate the absolute pledge split based on the offer's pledgeSplit percentage
        const absolutePledgeSplit = Math.round((offer.pledgeSplit / 100) * pledgeSum);
        // If the user is the client, they get the remaining amount after the freelancer's split
        // If the user is the freelancer, they get the pledge split
        return ticket.pubkey === user ? pledgeSum - absolutePledgeSplit : absolutePledgeSplit;
    }

    onDestroy(() => {
        allEarningsStore?.empty();
        allPaymentsStore?.empty();
        allPledgesStore?.empty();
    });

    function showFreelancerReviewBreakdown() {
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

    $: financialItems = [
        {
            title: 'The total amount of money this user has received for completing jobs',
            label: 'Earnings',
            amount: allEarnings,
        },
        {
            title: 'The total amount of money this user has paid freelancers that completed their jobs',
            label: 'Payments',
            amount: allPayments,
        },
        {
            title: 'The total amount of money this user has donated to help the development & maintenance of SatShoot',
            label: 'Pledges',
            amount: allPledges,
        },
    ];

    const reputationBlockWrapperClasses =
        'transition ease duration-[0.3s] flex flex-col cursor-pointer w-full gap-[5px] hover:text-white p-[10px] rounded-[4px] hover:bg-blue-500 hover:shadow-soft group';
    const satsWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row flex-wrap gap-[10px] justify-between items-center rounded-[4px] px-[10px] py-[5px] hover:bg-blue-500 group';
    const boltIconWrapperClasses =
        'flex flex-row gap-[5px] items-center flex-wrap grow-[1] group-hover:border-r-[1px] group-hover:border-r-white-200 group-hover:text-white';
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
                    <span class="badge px-4 {ratingColor}">{asFreelancerRatingConsensus}</span>
                </p>
            </Button>
            <div class="flex flex-row grow-[1] px-[20px]">
                <p class="font-[500]">
                    Total Earnings:
                    <span class="font-[300]">{insertThousandSeparator(allEarnings) + ' sats'}</span>
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
                    <span class="badge px-4 {ratingColor}">{asClientRatingConsensus}</span>
                </p>
            </Button>
            <div class="flex flex-row grow-[1] px-[20px]">
                <p class="font-[500]">
                    Total Payments:
                    <span class="font-[300]">{insertThousandSeparator(allPayments) + ' sats'}</span>
                </p>
            </div>
        {/if}

        <div class="flex flex-row grow-[1] px-[20px]">
            <p class="font-[500]">
                Total Pledges:
                <span class="font-[300]">{insertThousandSeparator(allPledges) + ' sats'}</span>
            </p>
        </div>
    </div>
{/if}

{#if forUserCard}
    <Card classes="gap-[15px]">
        <div class="w-full flex flex-col gap-[15px]">
            <div class="w-full flex flex-col gap-[10px]">
                <RatingBlock label="User's Overall Reputation" rating={ratingConsensus} />
                <div
                    class="w-full flex flex-col gap-[10px] border-[1px] border-black-100 dark:border-white-100 p-[10px] rounded-[4px] max-[768px]:flex-col"
                >
                    <button
                        class={reputationBlockWrapperClasses}
                        on:click={showFreelancerReviewBreakdown}
                    >
                        <RatingBlock
                            label="As a freelancer"
                            rating={asFreelancerRatingConsensus}
                            iconClass="bx bxs-star transition ease duration-[0.3s]"
                            hoverEffect={true}
                            color={asFreelancerRatingColor}
                        />
                    </button>
                    <button
                        class={reputationBlockWrapperClasses}
                        on:click={showClientReviewBreakdown}
                    >
                        <RatingBlock
                            label="As a client"
                            rating={asClientRatingConsensus}
                            iconClass="bx bxs-star transition ease duration-[0.3s]"
                            hoverEffect={true}
                            color={asClientRatingColor}
                        />
                    </button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[5px] rounded-[5px] p-[10px] border-[1px] border-black-200 dark:border-white-200"
            >
                {#each financialItems as { title, label, amount }}
                    <div {title} class={satsWrapperClasses}>
                        <p class={boltIconWrapperClasses}>
                            <i
                                class="bx bxs-bolt text-black-500 dark:text-white-500 group-hover:text-yellow-200"
                            />
                            {label}
                        </p>
                        <p class="group-hover:text-white">
                            {abbreviateNumber(amount) + ' sats'}
                        </p>
                    </div>
                {/each}
            </div>
        </div>
    </Card>
{/if}
