<script lang="ts">
    import { type BidEvent } from '$lib/events/BidEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import { createPaymentFilters, createPaymentStore, paymentDetail } from '$lib/stores/payment';
    import { freelancerReviews } from '$lib/stores/reviews';
    import currentUser from '$lib/stores/user';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        NDKUser,
        type NDKFilter,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import { nip19 } from 'nostr-tools';
    import { onDestroy } from 'svelte';
    import PaymentModal from '../Modals/PaymentModal.svelte';
    import TakeBidModal from '../Modals/TakeBidModal.svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ReputationCard from './ReputationCard.svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { sessionInitialized } from '$lib/stores/session';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';
    import { goto } from '$app/navigation';
    import { Pricing } from '$lib/events/types';

    interface Props {
        bid: BidEvent;
        skipUserProfile?: boolean;
        skipReputation?: boolean;
        showJobDetail?: boolean;
        showPayments?: boolean;
    }

    let {
        bid,
        skipUserProfile = false,
        skipReputation = false,
        showJobDetail = false,
        showPayments = false,
    }: Props = $props();

    let showTakeBidModal = $state(false);
    let showPaymentModal = $state(false);
    let showReviewModal = $state(false);

    const freelancerPaymentStore = $derived.by(() => {
        const freelancerFilters = createPaymentFilters(bid, 'freelancer');
        return createPaymentStore(freelancerFilters);
    });

    const satshootPaymentStore = $derived.by(() => {
        const satshootFilters = createPaymentFilters(bid, 'satshoot');
        return createPaymentStore(satshootFilters);
    });

    let freelancerPaid = $derived(freelancerPaymentStore.totalPaid);
    let satshootPaid = $derived.by(() => {
        return satshootPaymentStore.totalPaid;
    });

    const jobFilter: NDKFilter<NDKKind.FreelanceJob> = {
        kinds: [NDKKind.FreelanceJob],
        '#d': [bid.referencedJobAddress.split(':')[2]],
    };
    const jobStore = $ndk.storeSubscribe<JobEvent>(
        jobFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        JobEvent
    );

    const job = $derived.by(() => {
        return $jobStore[0] ?? null;
    });

    const winner = $derived(!!job && job.acceptedBidAddress === bid.bidAddress);

    const { status, statusColor } = $derived.by(() => {
        if (!job)
            return {
                status: '?',
                statusColor: 'text-primary-400-500',
            };

        const winnerId = job.acceptedBidAddress;
        if (winnerId === bid!.bidAddress) {
            return { status: 'Won', statusColor: 'text-warning-500' };
        } else if (winnerId || job.isClosed()) {
            return { status: 'Lost', statusColor: 'text-error-500' };
        } else {
            return { status: 'Pending', statusColor: 'text-primary-400-500' };
        }
    });

    const pricing = $derived.by(() => {
        if (bid.pricing === Pricing.Absolute) return 'sats';
        if (bid.pricing === Pricing.SatsPerMin) return 'sats/min';

        return '';
    });

    const myJob = $derived(!!$currentUser && !!job && $currentUser.pubkey === job.pubkey);

    const showPaymentButton = $derived(myJob && winner);

    const review = $derived.by(() => {
        if ($freelancerReviews) {
            return $freelancerReviews.find(
                (review) => review.reviewedEventAddress === bid.bidAddress
            );
        }
        return undefined;
    });

    let jobPosterProfile = $state<NDKUserProfile | null>(null);

    let jobPosterImage = $derived.by(() => {
        if (!jobPosterProfile) return '';

        return (
            jobPosterProfile?.picture ??
            jobPosterProfile?.image ??
            getRoboHashPicture(jobPoster!.pubkey)
        );
    });

    let jobPosterName = $derived.by(() => {
        if (!jobPosterProfile) return '?';

        return jobPosterProfile?.name ?? jobPoster!.npub.substring(0, 8);
    });

    let initialized = $state(false);
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            freelancerPaymentStore.paymentStore.startSubscription();
            satshootPaymentStore.paymentStore.startSubscription();
            jobStore.startSubscription();
        }
    });

    let jobPoster = $state<NDKUser | null>(null);

    $effect(() => {
        if (job) {
            setupJobPoster($ndk.getUser({ pubkey: job.pubkey }));
        }
    });

    const setupJobPoster = async (poster: NDKUser) => {
        jobPoster = poster;
        jobPosterProfile = await poster.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        });
    };

    function goToChat() {
        const url = new URL('/messages/' + job.encode(), window.location.origin);
        url.searchParams.append(SELECTED_QUERY_PARAM, bid.pubkey);
        goto(url.toString());
    }

    onDestroy(() => {
        if (jobStore) jobStore.empty();
        if (freelancerPaymentStore) freelancerPaymentStore.paymentStore.empty();
        if (satshootPaymentStore) satshootPaymentStore.paymentStore.empty();
    });

    function takeBid() {
        if (job) {
            showTakeBidModal = true;
        }
    }

    function handlePay() {
        // TODO: this should be a prop once skeleton is migrated
        $paymentDetail = {
            job: job!,
            bid,
        };

        showPaymentModal = true;
    }

    function handlePreviewReview() {
        showReviewModal = true;
    }
</script>

<Card classes="flex-wrap gap-[15px]">
    {#if !skipUserProfile}
        <UserProfile pubkey={bid.pubkey} />
    {/if}
    {#if !skipReputation}
        <ReputationCard user={bid.pubkey} type={ReviewType.Freelancer} />
    {/if}
    <div
        class="w-full border-[1px] border-black-100 dark:border-white-100 rounded-[4px] bg-black-50"
    >
        <ExpandableText text={bid.description} maxCharacters={200} renderAsMarkdown />
        <div
            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100"
        >
            <div class="grow-1">
                <p class="font-[500]">
                    Bid cost:
                    <span class="font-[300]">
                        {insertThousandSeparator(bid.amount) + ' ' + pricing}
                    </span>
                </p>
            </div>
            <div class="grow-1">
                <p class="font-[500]">
                    Pledge split:
                    <span class="font-[300]"> {bid.pledgeSplit + ' %'} </span>
                </p>
            </div>
            {#if showPayments}
                <div class="grow-1">
                    <p class="font-[500]">
                        Freelancer Paid:
                        <span class="font-[300]">
                            {insertThousandSeparator($freelancerPaid)} sats
                        </span>
                    </p>
                </div>
                <div class="grow-1">
                    <p class="font-[500]">
                        SatShoot Paid:
                        <span class="font-[300]">
                            {insertThousandSeparator($satshootPaid)} sats
                        </span>
                    </p>
                </div>
            {/if}
        </div>
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px]"
    >
        {#if bid.created_at}
            <p class="font-[500] grow-1 flex flex-row flex-wrap">
                Bid published on:
                <span class="font-[300]">
                    {formatDate(bid.created_at * 1000, 'dd-MMM-yyyy, h:m a') +
                        ', ' +
                        formatDistanceToNow(bid.created_at * 1000) +
                        ' Ago'}
                </span>
            </p>
        {/if}
        <p class="font-[500] grow-1 flex flex-row flex-wrap">
            Bid Status:
            <span class="ml-[5px] font-[300] {statusColor}"> {status} </span>
        </p>
    </div>
    {#if showJobDetail && job}
        <div
            class="w-full flex flex-row flex-wrap items-center gap-[10px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px]"
        >
            <div class="font-[500] grow-1 flex flex-row items-center flex-wrap gap-[10px]">
                <p>Job Title:</p>
                <a
                    href={'/' + job.encode() + '/'}
                    class="text-blue-600 hover:text-blue-800 hover:underline"
                >
                    <h4 class="font-semibold text-[18px] overflow-hidden line-clamp-2">
                        {job.title}
                    </h4>
                </a>
            </div>

            <div class="font-[500] grow-1 flex flex-row items-center flex-wrap gap-[10px]">
                <p>Job Posted By:</p>
                <a
                    href={'/' + nip19.npubEncode(job.pubkey)}
                    class="flex flex-row items-center grow-1 gap-[10px]"
                >
                    {#if jobPosterImage}
                        <ProfileImage src={jobPosterImage} size="xs" />
                    {/if}
                    <span>{jobPosterName}</span>
                </a>
            </div>
        </div>
    {/if}

    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px] justify-end"
    >
        {#if myJob && job && job.status === JobStatus.New}
            <Button onClick={takeBid}>Take bid</Button>
        {/if}

        {#if showPaymentButton}
            <Button onClick={handlePay}>Pay</Button>
        {/if}

        {#if job && myJob}
            <Button onClick={goToChat}>Message</Button>
        {/if}

        {#if review}
            <Button onClick={handlePreviewReview}>Preview Review</Button>
        {/if}
    </div>
</Card>

<PaymentModal bind:isOpen={showPaymentModal} />

{#if job}
    <TakeBidModal bind:isOpen={showTakeBidModal} {job} {bid} />
{/if}

{#if review}
    <ReviewModal bind:isOpen={showReviewModal} {review} />
{/if}
