<script lang="ts">
    import { BidEvent } from '$lib/events/BidEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import {
        aggregateClientRatings,
        aggregateFreelancerRatings,
        clientReviews,
        freelancerReviews,
    } from '$lib/stores/reviews';
    import { sessionInitialized } from '$lib/stores/session';
    import { wot } from '$lib/stores/wot';
    import { averageToRatingText } from '$lib/utils/helpers';
    import { abbreviateNumber, SatShootPubkey } from '$lib/utils/misc';
    import {
        NDKKind,
        NDKNutzap,
        NDKSubscriptionCacheUsage,
        zapInvoiceFromEvent,
        type Hexpubkey,
        type NDKEvent,
        type NDKFilter,
    } from '@nostr-dev-kit/ndk';
    import { onDestroy } from 'svelte';
    import ReviewSummaryAsFreelancer from '../Modals/ReviewSummaryAsFreelancer.svelte';
    import ReviewSummaryAsClient from '../Modals/ReviewSummaryAsClient.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import RatingBlock from '../UI/Display/RatingBlock.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';

    interface Props {
        user: Hexpubkey;
        type?: ReviewType;
        skipUserProfile?: boolean;
        forUserCard?: boolean;
    }

    let { user, type = undefined, skipUserProfile = false, forUserCard = false }: Props = $props();

    let initInProgress = $state(true);

    // Earnings
    const allEarningsFilter: NDKFilter = {
        kinds: [NDKKind.Zap, NDKKind.Nutzap],
    };
    const allEarningsStore = $ndk.storeSubscribe(allEarningsFilter, {
        autoStart: false,
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
    });
    let allEarnings = $derived(calculateTotalAmount(Array.from($allEarningsStore)));

    // Payments
    const allPaymentsFilter: NDKFilter = {
        kinds: [NDKKind.Zap, NDKKind.Nutzap],
    };
    const allPaymentsStore = $ndk.storeSubscribe(allPaymentsFilter, {
        autoStart: false,
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
    });
    let allPayments = $derived(calculateTotalAmount(Array.from($allPaymentsStore)));

    // Pledges
    const involvedJobEvents: JobEvent[] = [];
    const involvedBids: BidEvent[] = [];

    const allPledgesFilter: NDKFilter = {
        kinds: [NDKKind.Zap, NDKKind.Nutzap],
    };
    const allPledgesStore = $ndk.storeSubscribe(allPledgesFilter, {
        autoStart: false,
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
    });
    let allPledges = $derived(
        calculatePledges($allPledgesStore, involvedJobEvents, involvedBids, user)
    );

    // Init
    $effect(() => {
        if ($sessionInitialized) {
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
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        };

        const winningBidsOfUser: string[] = [];
        const winningBidsForUser: string[] = [];
        const involvedJobs: string[] = [];

        // Earnings of target user, Clients filtered by CURRENT users wot
        const userBids = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceBid],
                authors: [user],
            },
            subOptions
        );

        const allJobsUserWon = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceJob],
                '#a': Array.from(userBids).map((o) => o.tagAddress()),
            },
            subOptions
        );

        for (const wonJob of allJobsUserWon) {
            const jobEvent = JobEvent.from(wonJob);
            if ($wot.has(jobEvent.pubkey)) {
                const bidOfJob = Array.from(userBids).find(
                    (o) => o.tagAddress() === jobEvent.acceptedBidAddress
                );
                if (bidOfJob) {
                    involvedJobs.push(jobEvent.jobAddress);
                    winningBidsOfUser.push(bidOfJob.id);

                    involvedJobEvents.push(jobEvent);
                    involvedBids.push(BidEvent.from(bidOfJob));
                } else {
                    console.error('BUG: Bid for this job SHOULD be found');
                }
            }
        }

        (allEarningsFilter['#p'] = [user]), (allEarningsFilter['#e'] = winningBidsOfUser);
        allEarningsStore.startSubscription();

        // Payments of target user, Freelancers filtered by CURRENT users wot
        const userJobs = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceJob],
                authors: [user],
            },
            subOptions
        );

        const allWinningBidsOnUserJobs = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceBid],
                '#a': Array.from(userJobs).map((t) => t.tagAddress()),
            },
            subOptions
        );

        for (const bid of allWinningBidsOnUserJobs) {
            const bidEvent = BidEvent.from(bid);
            if ($wot.has(bidEvent.pubkey)) {
                const jobOfBid = Array.from(userJobs).find(
                    (t) => t.tagAddress() === bidEvent.referencedJobAddress
                );
                if (jobOfBid) {
                    involvedJobs.push(jobOfBid.tagAddress());
                    winningBidsForUser.push(bidEvent.id);

                    involvedJobEvents.push(JobEvent.from(jobOfBid));
                    involvedBids.push(bidEvent);
                } else {
                    console.error('BUG: Job for this bid SHOULD be found');
                }
            }
        }

        allPaymentsFilter['#e'] = winningBidsForUser;
        allPaymentsStore.startSubscription();

        // Pledges of target user, both as a Freelancer and as a Client,
        // Counterparties in both cases filtered by CURRENT users wot
        allPledgesFilter['#a'] = involvedJobs;
        allPledgesFilter['#p'] = [SatShootPubkey];
        allPledgesStore.startSubscription();

        initInProgress = false;
    };

    onDestroy(() => {
        allEarningsStore.empty();
        allPaymentsStore.empty();
        allPledgesStore.empty();
    });

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
     * It sums up the user's share of pledges based on their role (client or freelancer) in the associated jobs and bids.
     *
     * @param events - An array of NDKEvent objects representing zaps or nutzaps.
     * @param jobs - An array of JobEvent objects representing jobs.
     * @param bids - An array of BidEvent objects representing bids.
     * @param user - The hexpubkey of the user for whom the pledges are being calculated.
     * @returns The total amount of pledges (in sats) that the user is entitled to.
     */
    function calculatePledges(
        events: NDKEvent[],
        jobs: JobEvent[],
        bids: BidEvent[],
        user: Hexpubkey
    ): number {
        return events.reduce((total, zap) => {
            // Calculate the total amount of the zap/nutzap in sats
            const pledgeSum = calculatePledgeSum(zap);
            if (pledgeSum > 0) {
                // Find the associated job and bid for the zap/nutzap
                const { job, bid } = getJobAndBid(zap, jobs, bids);
                if (job && bid) {
                    // Calculate the user's share of the pledge based on their role
                    const userShare = calculateUserShare(pledgeSum, job, bid, user);
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
     * Finds the job and bid associated with a zap/nutzap event.
     *
     * @param zap - An NDKEvent object representing a zap or nutzap.
     * @param jobs - An array of JobEvent objects representing jobs.
     * @param bids - An array of BidEvent objects representing bids.
     * @returns An object containing the associated job and bid, or undefined if not found.
     */
    function getJobAndBid(
        zap: NDKEvent,
        jobs: JobEvent[],
        bids: BidEvent[]
    ): { job: JobEvent | undefined; bid: BidEvent | undefined } {
        // Find the job associated with the zap/nutzap using the 'a' tag
        const job = jobs.find((t) => t.jobAddress === zap.tagValue('a'));
        // Find the bid associated with the job's accepted bid address
        const bid = bids.find((o) => o.bidAddress === job?.acceptedBidAddress);
        return { job, bid };
    }

    /**
     * Calculates the user's share of a pledge based on their role (client or freelancer).
     *
     * @param pledgeSum - The total amount of the pledge in sats.
     * @param job - The JobEvent object associated with the pledge.
     * @param bid - The BidEvent object associated with the pledge.
     * @param user - The hexpubkey of the user for whom the share is being calculated.
     * @returns The user's share of the pledge in sats.
     */
    function calculateUserShare(
        pledgeSum: number,
        job: JobEvent,
        bid: BidEvent,
        user: Hexpubkey
    ): number {
        // Calculate the absolute pledge split based on the bid's pledgeSplit percentage
        const absolutePledgeSplit = Math.round((bid.pledgeSplit / 100) * pledgeSum);
        // If the user is the client, they get the remaining amount after the freelancer's split
        // If the user is the freelancer, they get the pledge split
        return job.pubkey === user ? pledgeSum - absolutePledgeSplit : absolutePledgeSplit;
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

    let showReviewSummaryAsFreelancer = $state(false);
    let showReviewSummaryAsClient = $state(false);

    function showFreelancerReviewBreakdown() {
        showReviewSummaryAsFreelancer = true;
    }

    function showClientReviewBreakdown() {
        showReviewSummaryAsClient = true;
    }

    const reputationBlockWrapperClasses =
        'transition ease duration-[0.3s] flex flex-col cursor-pointer w-full gap-[5px] hover:text-white p-[10px] rounded-[4px] hover:bg-blue-500 hover:shadow-soft group';
    const satsWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row flex-wrap gap-[10px] justify-between items-center rounded-[4px] px-[10px] py-[5px] hover:bg-blue-500 group';
    const boltIconWrapperClasses =
        'flex flex-row gap-[5px] items-center flex-wrap grow-[1] group-hover:border-r-[1px] group-hover:border-r-white-200 group-hover:text-white';
</script>

{#if !forUserCard}
    <div class="flex flex-row items-center gap-[10px]">
        <div>
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
            {:else if reviewType === ReviewType.Client}
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
