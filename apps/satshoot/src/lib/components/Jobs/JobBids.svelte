<script lang="ts">
    import { BidEvent } from '$lib/events/BidEvent';
    import { JobStatus, type JobEvent } from '$lib/events/JobEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import {
        createPaymentFilters,
        createPaymentStore,
        type PaymentStore,
    } from '$lib/stores/payment';
    import { getJobStatusColor, getJobStatusString } from '$lib/utils/job';
    import { abbreviateNumber, insertThousandSeparator } from '$lib/utils/misc';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        NDKUser,
        type NDKFilter,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import Card from '../UI/Card.svelte';
    import { Popover } from '@skeletonlabs/skeleton-svelte';
    import { onDestroy } from 'svelte';
    import { Pricing } from '$lib/events/types';

    interface Props {
        job: JobEvent;
    }

    let { job }: Props = $props();

    let paymentPopoverState = $state(false);

    const statusString = $derived(getJobStatusString(job.status));
    const statusColor = $derived(getJobStatusColor(job.status));

    let bids = $state<BidEvent[]>([]);
    let winningBid = $state<BidEvent | null>(null);

    const pricing = $derived.by(() => {
        if (winningBid) {
            switch (winningBid.pricing) {
                case Pricing.Absolute:
                    return 'sats';
                case Pricing.Hourly:
                    return 'sats/hour';
            }
        }
        return '';
    });

    let freelancerPaymentStore = $state<PaymentStore>();

    const jobWinner = $derived.by(() => {
        if (!job.winnerFreelancer) return null;

        const winner = $ndk.getUser({ pubkey: job.winnerFreelancer });

        fetchJobWinnerProfile(winner);

        return winner;
    });

    let jobWinnerProfile = $state<NDKUserProfile | null>(null);

    const fetchJobWinnerProfile = async (winner: NDKUser) => {
        const profile = await winner.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        });
        jobWinnerProfile = profile;
    };

    let freelancerName = $derived.by(() => {
        if (!jobWinnerProfile) return '?';

        return jobWinnerProfile?.name ?? jobWinner!.npub.substring(0, 8);
    });

    let freelancerPaid = $derived.by(() => {
        if (!freelancerPaymentStore) return null;

        return freelancerPaymentStore.totalPaid;
    });

    // Effect to fetch winning bid
    $effect(() => {
        if ($sessionInitialized) init();
    });

    const init = async () => {
        if (job.acceptedBidAddress) {
            const bid = await $ndk.fetchEvent(job.acceptedBidAddress, {
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            console.log('Winning bid:', bid);
            if (bid) {
                winningBid = BidEvent.from(bid);
                const freelancerFilters = createPaymentFilters(winningBid, job, 'freelancer');
                freelancerPaymentStore = createPaymentStore(freelancerFilters);
                freelancerPaymentStore.paymentStore.startSubscription();
            }
        }

        const bidsFilter: NDKFilter = {
            kinds: [NDKKind.FreelanceBid],
            '#a': [job.jobAddress],
        };

        const events = await $ndk.fetchEvents(bidsFilter, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        bids = Array.from(events).map((event) => BidEvent.from(event));
    };

    onDestroy(() => {
        freelancerPaymentStore?.paymentStore.empty();
    });

    const boxWrapperClasses =
        'transition-all ease-in-out duration-[0.3s] flex flex-row gap-[5px] p-[5px_10px] ' +
        'rounded-[6px] bg-black-100 text-black-500 dark:bg-white-100 dark:text-white items-center ' +
        'outline outline-[2px] outline-[rgba(0,0,0,0.15)] text-[14px] grow w-full';
</script>

<div class="flex flex-col grow-1 gap-[10px] p-[0px]">
    <div class="w-full flex flex-row gap-[10px] flex-wrap">
        <div class={boxWrapperClasses}>
            <p class="font-[600]">Status:</p>
            <p class="line-clamp-1 overflow-hidden {statusColor}">{statusString}</p>
        </div>
        <div class={boxWrapperClasses}>
            <p class="font-[600]">{job.status === JobStatus.New ? 'Pending ' : ''} Bids:</p>
            <p class="line-clamp-1 overflow-hidden">
                {insertThousandSeparator(bids.length)}
            </p>
        </div>
        {#if jobWinner}
            <div class={boxWrapperClasses}>
                <p class="font-[600]">Freelancer:</p>
                <a
                    href={'/' + nip19.npubEncode(job.winnerFreelancer!)}
                    class="font-[600] line-clamp-1 overflow-hidden max-w-[200px]"
                >
                    {freelancerName}
                </a>
            </div>
        {/if}

        {#if winningBid}
            <div class={boxWrapperClasses}>
                <p class="font-[600]">
                    Payments
                    <Popover
                        open={paymentPopoverState}
                        onOpenChange={(e) => (paymentPopoverState = e.open)}
                        positioning={{ placement: 'top' }}
                        triggerBase="btn preset-tonal"
                        contentBase="card bg-surface-200-800 p-4 space-y-4 max-w-[320px]"
                        arrow
                        arrowBackground="!bg-surface-200 dark:!bg-surface-800"
                    >
                        {#snippet trigger()}
                            <i
                                class="bx bx-question-mark bg-blue-500 text-white p-[3px] rounded-[50%]"
                            ></i>
                        {/snippet}
                        {#snippet content()}
                            <Card>
                                <p>Amount paid to freelancer / Amount promised for job</p>
                            </Card>
                        {/snippet}
                    </Popover>
                </p>

                <p class="line-clamp-1 overflow-hidden">
                    <span>
                        {$freelancerPaid ? abbreviateNumber($freelancerPaid) : '?'}
                    </span>
                    <span>/</span>
                    <span>
                        {`${abbreviateNumber(winningBid.amount)} ${pricing}`}
                    </span>
                </p>
            </div>
        {/if}
    </div>
</div>
