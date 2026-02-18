<script lang="ts">
    import { type BidEvent } from '$lib/events/BidEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import {
        createPaymentFilters,
        createPaymentStore,
        type PaymentStore,
    } from '$lib/stores/payment';
    import { freelancerReviews } from '$lib/stores/reviews';
    import currentUser from '$lib/stores/user';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import {
        NDKSubscriptionCacheUsage,
        NDKUser,
        type NDKFilter,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import { nip19 } from 'nostr-tools';
    import { onDestroy } from 'svelte';
    import TakeBidModal from '../Modals/TakeBidModal.svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ReputationCard from './ReputationCard.svelte';
    import { sessionInitialized } from '$lib/stores/session';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';
    import { goto } from '$app/navigation';
    import { Pricing } from '$lib/events/types';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';
    import Avatar from '../Users/Avatar.svelte';

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
    let showReviewModal = $state(false);

    let freelancerPaymentStore = $state<PaymentStore | null>(null);
    let satshootPaymentStore = $state<PaymentStore | null>(null);
    let sponsoredNpubPaymentStore = $state<PaymentStore | null>(null);

    let freelancerPaid = $derived(freelancerPaymentStore?.totalPaid ?? null);
    let satshootPaid = $derived(satshootPaymentStore?.totalPaid ?? null);
    let sponsoredNpubPaid = $derived(sponsoredNpubPaymentStore?.totalPaid ?? null);

    const jobFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceJob],
    };
    const jobStore = $ndk.storeSubscribe<JobEvent>(
        jobFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        },
        JobEvent
    );

    let jobStoreStarted = $state(false);
    let jobFilterKey = $state<string | null>(null);

    const job = $derived.by(() => {
        if ($jobStore.length === 0) return null;
        return $jobStore.reduce((latest, current) => {
            if (!latest) return current;
            const latestCreated = latest.created_at ?? 0;
            const currentCreated = current.created_at ?? 0;
            return currentCreated >= latestCreated ? current : latest;
        }, $jobStore[0]);
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
            return { status: 'Won', statusColor: 'text-yellow-500' };
        } else if (winnerId || job.isClosed()) {
            return { status: 'Lost', statusColor: 'text-error-500' };
        } else {
            return { status: 'Pending', statusColor: 'text-primary-400-500' };
        }
    });

    const pricing = $derived.by(() => {
        if (bid.pricing === Pricing.Absolute) return 'sats';
        if (bid.pricing === Pricing.Hourly) return 'sats/hour';

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

    let jobPosterName = $derived.by(() => {
        if (!jobPosterProfile) return '?';

        return jobPosterProfile?.name ?? jobPoster!.npub.substring(0, 8);
    });

    let initialized = $state(false);
    $effect(() => {
        if (!$sessionInitialized || initialized) return;
        initialized = true;
    });

    $effect(() => {
        if (!initialized) return;

        const parts = bid.referencedJobAddress?.split(':') ?? [];
        const author = parts[1];
        const dTag = parts[2];

        if (!dTag) {
            jobStore.empty();
            jobStore.unsubscribe?.();
            jobStoreStarted = false;
            jobFilterKey = null;
            return;
        }

        const nextFilterKey = `${author ?? ''}:${dTag}`;
        if (jobStoreStarted && jobFilterKey === nextFilterKey) return;
        jobFilterKey = nextFilterKey;

        jobFilter['#d'] = [dTag];
        if (author) {
            jobFilter.authors = [author];
        } else {
            delete jobFilter.authors;
        }

        jobStore.changeFilters?.([jobFilter]);
        jobStore.startSubscription();
        jobStoreStarted = true;
    });

    let jobPoster = $state<NDKUser | null>(null);
    let jobBasedSetupDone = $state(false);
    $effect(() => {
        if (job && !jobBasedSetupDone) {
            jobBasedSetupDone = true;
            jobPoster = $ndk.getUser({ pubkey: job.pubkey });
            startPaymentSubs(job as JobEvent);
        }
    });

    const startPaymentSubs = (jobEvent: JobEvent) => {
        const freelancerFilters = createPaymentFilters(bid, jobEvent, 'freelancer');
        const satshootFilters = createPaymentFilters(bid, jobEvent, 'satshoot');
        const sponsoredNpubFilters = createPaymentFilters(bid, jobEvent, 'sponsored');

        freelancerPaymentStore = createPaymentStore(freelancerFilters);
        satshootPaymentStore = createPaymentStore(satshootFilters);
        sponsoredNpubPaymentStore = createPaymentStore(sponsoredNpubFilters);

        freelancerPaymentStore.paymentStore.startSubscription();
        satshootPaymentStore.paymentStore.startSubscription();
        sponsoredNpubPaymentStore.paymentStore.startSubscription();
    };

    function goToChat() {
        if (!job) return;
        const url = new URL('/messages/' + job.encode(), window.location.origin);
        url.searchParams.append(SELECTED_QUERY_PARAM, bid.pubkey);
        goto(url.toString());
    }

    onDestroy(() => {
        if (jobStore) {
            jobStore.unsubscribe?.();
            jobStore.empty();
        }
        if (freelancerPaymentStore) freelancerPaymentStore.paymentStore.unsubscribe();
        if (satshootPaymentStore) satshootPaymentStore.paymentStore.unsubscribe();
        if (sponsoredNpubPaymentStore) sponsoredNpubPaymentStore.paymentStore.unsubscribe();
        initialized = false;
    });

    function takeBid() {
        if (job) {
            showTakeBidModal = true;
        }
    }

    function goToPay() {
        const url = new URL('/payments/' + bid.encode(), window.location.origin);
        goto(url.toString());
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
                    Price:
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
            {#if bid.sponsoringSplit && bid.sponsoredNpub}
                <div class="grow-1">
                    <p class="font-[500]">
                        Sponsoring split:
                        <span class="font-[300]"> {bid.sponsoringSplit + ' %'} </span>
                    </p>
                </div>
            {/if}
            {#if showPayments}
                <div class="grow-1">
                    <p class="font-[500]">
                        Freelancer Paid:
                        <span class="font-[300]">
                            {$freelancerPaid ? insertThousandSeparator($freelancerPaid) : '?'} sats
                        </span>
                    </p>
                </div>
                <div class="grow-1">
                    <p class="font-[500]">
                        SatShoot Paid:
                        <span class="font-[300]">
                            {$satshootPaid ? insertThousandSeparator($satshootPaid) : '?'} sats
                        </span>
                    </p>
                </div>
                {#if bid.sponsoringSplit && bid.sponsoredNpub}
                    <div class="grow-1">
                        <p class="font-[500]">
                            Sponsored Paid:
                            {$sponsoredNpubPaid ? insertThousandSeparator($sponsoredNpubPaid) : '?'}
                            sats
                        </p>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px]"
    >
        {#if bid.publishedAt}
            <p class="font-[500] grow-1 flex flex-row flex-wrap">
                Bid published on:
                <span class="font-[300]">
                    {formatDate(bid.publishedAt * 1000, 'dd-MMM-yyyy, h:m a') +
                        ', ' +
                        formatDistanceToNow(bid.publishedAt * 1000) +
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
                <a href={'/' + job.encode() + '/'} class="link">
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
                    <Avatar pubkey={job.pubkey} bind:userProfile={jobPosterProfile} />
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
            <Button onClick={goToPay}>Pay</Button>
        {/if}

        {#if job && myJob}
            <Button onClick={goToChat}>Message</Button>
        {/if}

        {#if review}
            <Button onClick={handlePreviewReview}>Preview Review</Button>
        {/if}
    </div>
</Card>

{#if job}
    <TakeBidModal bind:isOpen={showTakeBidModal} {job} {bid} />
{/if}

{#if review}
    <ReviewModal bind:isOpen={showReviewModal} {review} />
{/if}
