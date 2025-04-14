<script lang="ts">
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import {
        aggregateClientRatings,
        aggregateFreelancerRatings,
        clientReviews,
        freelancerReviews,
    } from '$lib/stores/reviews';
    import { wot, wotLoaded } from '$lib/stores/wot';
    import { averageToRatingText } from '$lib/utils/helpers';
    import { abbreviateNumber, SatShootPubkey } from '$lib/utils/misc';
    import {
        NDKKind,
        NDKNutzap,
        NDKSubscriptionCacheUsage,
        zapInvoiceFromEvent,
        type Hexpubkey,
        type NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import { onDestroy } from 'svelte';
    import ReviewSummaryAsFreelancer from '../Modals/ReviewSummaryAsFreelancer.svelte';
    import ReviewSummaryAsClient from '../Modals/ReviewSummaryAsClient.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import RatingBlock from '../UI/Display/RatingBlock.svelte';

    interface Props {
        user: Hexpubkey;
        type?: ReviewType;
        forUserCard?: boolean;
    }

    let { user, type = undefined, forUserCard = false }: Props = $props();

    let showReviewSummaryAsFreelancer = $state(false);
    let showReviewSummaryAsClient = $state(false);

    let allEarningsEvents: Set<NDKEvent> = new Set();
    let allPaymentsEvents: Set<NDKEvent> = new Set();
    let allPledgesEvents: Set<NDKEvent> = new Set();

    let allEarnings = $state(0);
    let allPayments = $state(0);
    let allPledges = $state(0);

    let initInProgress = $state(true);

    // Init
    $effect(() => {
        if ($wotLoaded) {
            console.log('INIT Reputation');
            init();
        }
    });

    const init = async () => {
        const subOptions = {
            // Not enough places where we view many ppls rep to justify grouping yet
            // groupable: true,
            // groupableDelay: 300,
            // The info we need here is most likely already in the cache
            // since this info is important to the notifications as well
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        };

        const winningOffersOfUser: string[] = [];
        const winningOffersForUser: string[] = [];
        const involvedTickets: string[] = [];
        const involvedTicketEvents: TicketEvent[] = [];
        const involvedOffers: OfferEvent[] = [];

        // Earnings of target user, Clients filtered by CURRENT users wot
        const userOffers = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceOffer],
                authors: [user],
            },
            subOptions
        );

        console.log('userOffers', userOffers);

        const allTicketsUserWon = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceTicket],
                '#a': Array.from(userOffers).map((o) => o.tagAddress()),
            },
            subOptions
        );

        for (const wonTicket of allTicketsUserWon) {
            const ticketEvent = TicketEvent.from(wonTicket);
            if ($wot.has(ticketEvent.pubkey)) {
                const offerOfTicket = Array.from(userOffers).find(
                    (o) => o.tagAddress() === ticketEvent.acceptedOfferAddress
                );
                if (offerOfTicket) {
                    involvedTickets.push(ticketEvent.ticketAddress);
                    winningOffersOfUser.push(offerOfTicket.id);

                    involvedTicketEvents.push(ticketEvent);
                    involvedOffers.push(OfferEvent.from(offerOfTicket));
                } else {
                    console.error('BUG: Offer for this ticket SHOULD be found');
                }
            }
        }

        console.log('winningOffersOfUser', winningOffersOfUser);

        allEarningsEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#p': [user],
                '#e': winningOffersOfUser,
            },
            subOptions
        );
        allEarnings = calculateTotalAmount(Array.from(allEarningsEvents));

        // Payments of target user, Freelancers filtered by CURRENT users wot
        const userTickets = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceTicket],
                authors: [user],
            },
            subOptions
        );

        const allWinningOffersOnUserTickets = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceOffer],
                '#a': Array.from(userTickets).map((t) => t.tagAddress()),
            },
            subOptions
        );

        for (const offer of allWinningOffersOnUserTickets) {
            const offerEvent = OfferEvent.from(offer);
            if ($wot.has(offerEvent.pubkey)) {
                const ticketOfOffer = Array.from(userTickets).find(
                    (t) => t.tagAddress() === offerEvent.referencedTicketAddress
                );
                if (ticketOfOffer) {
                    involvedTickets.push(ticketOfOffer.tagAddress());
                    winningOffersForUser.push(offerEvent.id);

                    involvedTicketEvents.push(TicketEvent.from(ticketOfOffer));
                    involvedOffers.push(offerEvent);
                } else {
                    console.error('BUG: Ticket for this offer SHOULD be found');
                }
            }
        }

        allPaymentsEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#e': winningOffersForUser,
            },
            subOptions
        );
        allPayments = calculateTotalAmount(Array.from(allPaymentsEvents));

        // Pledges of target user, both as a Freelancer and as a Client,
        // Counterparties in both cases filtered by CURRENT users wot
        allPledgesEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#a': involvedTickets,
                '#p': [SatShootPubkey],
            },
            subOptions
        );
        allPledges = calculatePledges(
            Array.from(allPledgesEvents),
            involvedTicketEvents,
            involvedOffers,
            user
        );
        initInProgress = false;
    };

    // Derived review data
    const clientAverage = $derived(aggregateClientRatings(user).average);
    const freelancerAverage = $derived(aggregateFreelancerRatings(user).average);

    const reviewType = $derived(
        type ??
            ($clientReviews && $freelancerReviews
                ? $clientReviews.length > $freelancerReviews.length
                    ? ReviewType.Client
                    : ReviewType.Freelancer
                : undefined)
    );

    const overallAverage = $derived(
        reviewType === ReviewType.Client
            ? clientAverage
            : reviewType === ReviewType.Freelancer
              ? freelancerAverage
              : calculateOverallAverage(clientAverage, freelancerAverage)
    );

    const { ratingConsensus, ratingColor } = $derived(averageToRatingText(overallAverage));

    const { ratingConsensus: asClientRatingConsensus, ratingColor: asClientRatingColor } = $derived(
        averageToRatingText(clientAverage)
    );

    const { ratingConsensus: asFreelancerRatingConsensus, ratingColor: asFreelancerRatingColor } =
        $derived(averageToRatingText(freelancerAverage));

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

    function showFreelancerReviewBreakdown() {
        showReviewSummaryAsFreelancer = true;
    }

    function showClientReviewBreakdown() {
        showReviewSummaryAsClient = true;
    }

    let financialItems = $derived([
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
    ]);

    const reputationBlockWrapperClasses =
        'transition ease duration-[0.3s] flex flex-col cursor-pointer w-full gap-[5px] hover:text-white p-[10px] rounded-[4px] hover:bg-blue-500 hover:shadow-soft group';
    const satsWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row flex-wrap gap-[10px] justify-between items-center rounded-[4px] px-[10px] py-[5px] hover:bg-blue-500 group';
    const boltIconWrapperClasses =
        'flex flex-row gap-[5px] items-center flex-wrap grow-1 group-hover:border-r-[1px] group-hover:border-r-white-200 group-hover:text-white';
</script>

{#if !forUserCard}
    <div class="w-full flex flex-row flex-wrap items-center gap-[10px] px-[5px]">
        {#if reviewType === ReviewType.Freelancer}
            <Button
                variant="outlined"
                classes="justify-start"
                grow
                onClick={showFreelancerReviewBreakdown}
            >
                <p class="font-[500]">
                    Freelancer Reputation:
                    <span class="badge px-4 {ratingColor}">{asFreelancerRatingConsensus}</span>
                </p>
            </Button>
            <div class="flex flex-row grow-1 px-[20px] gap-x-1">
                <div class="font-bold">Total Earnings:</div>
                {#if initInProgress}
                    <div class="placeholder bg-primary-300-600-token animate-pulse w-12"></div>
                {:else}
                    <p class="font-[500]">
                        <span class="font-[300]">
                            {abbreviateNumber(allEarnings) + ' sats'}
                        </span>
                    </p>
                {/if}
            </div>
        {/if}

        {#if reviewType === ReviewType.Client}
            <Button
                variant="outlined"
                classes="justify-start"
                grow
                onClick={showClientReviewBreakdown}
            >
                <p class="font-[500]">
                    Client Reputation:
                    <span class="badge px-4 {ratingColor}">{asClientRatingConsensus}</span>
                </p>
            </Button>
            <div class="flex flex-row grow-1 px-[20px] gap-x-1">
                <div class="font-bold">Total Payments:</div>
                {#if initInProgress}
                    <div class="placeholder bg-primary-300-600-token animate-pulse w-12"></div>
                {:else}
                    <p class="font-[500]">
                        <span class="font-[300]">
                            {abbreviateNumber(allPayments) + ' sats'}
                        </span>
                    </p>
                {/if}
            </div>
        {/if}

        <div class="flex flex-row grow-1 px-[20px] gap-x-1">
            <div class="font-bold">Total Pledges:</div>
            {#if initInProgress}
                <div class="placeholder bg-primary-300-600-token animate-pulse w-12"></div>
            {:else}
                <p class="font-[500]">
                    <span class="font-[300]">
                        {abbreviateNumber(allPledges) + ' sats'}
                    </span>
                </p>
            {/if}
        </div>
    </div>
{/if}

{#if forUserCard}
    <Card classes="gap-[15px]">
        <div class="w-full flex flex-col gap-[15px]">
            <div class="w-full flex flex-col gap-[10px]">
                <div class="h4 sm:h3 text-center underline">Reputation</div>
                <div
                    class="w-full flex flex-col gap-[10px] border-[1px] border-black-100 dark:border-white-100 p-[10px] rounded-[4px] max-[768px]:flex-col"
                >
                    <button
                        class={reputationBlockWrapperClasses}
                        onclick={showFreelancerReviewBreakdown}
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
                        onclick={showClientReviewBreakdown}
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
                            ></i>
                            {label}
                        </p>
                        {#if initInProgress}
                            <div
                                class="placeholder bg-primary-300-600-token animate-pulse w-12"
                            ></div>
                        {:else}
                            <p class="group-hover:text-white">
                                {abbreviateNumber(amount) + ' sats'}
                            </p>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </Card>
{/if}

<ReviewSummaryAsFreelancer bind:isOpen={showReviewSummaryAsFreelancer} userHex={user} />
<ReviewSummaryAsClient bind:isOpen={showReviewSummaryAsClient} userHex={user} />
