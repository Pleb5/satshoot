<script lang="ts">
    import Button from '../UI/Buttons/Button.svelte';
    import ShareJobModal from '../Modals/ShareJobModal.svelte';
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import currentUser from '$lib/stores/user';
    import { clientReviews } from '$lib/stores/reviews';
    import { BidEvent } from '$lib/events/BidEvent';
    import ndk from '$lib/stores/session';
    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { jobToEdit } from '$lib/stores/job-to-edit';
    import { goto } from '$app/navigation';
    import CloseJobModal from '../Modals/CloseJobModal.svelte';
    import { paymentDetail } from '$lib/stores/payment';
    import PaymentModal from '../Modals/PaymentModal.svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import ReviewClientModal from '../Modals/ReviewClientModal.svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';

    interface Props {
        job: JobEvent;
    }

    let { job }: Props = $props();

    // Reactive states
    let winnerBid = $state<BidEvent | null>(null);
    let showShareModal = $state(false);
    let showCloseJobModal = $state(false);
    let showReviewClientModal = $state(false);
    let showPaymentModal = $state(false);
    let showReviewModal = $state(false);

    // Derived states
    const bech32ID = $derived(job.encode());
    const myJob = $derived($currentUser?.pubkey === job.pubkey);
    const showMessageButton = $derived(
        !!$currentUser && (myJob || job.winnerFreelancer === $currentUser.pubkey)
    );

    const review = $derived(
        $clientReviews.find((review) => review.reviewedEventAddress === job.jobAddress)
    );

    const canReviewClient = $derived.by(() => {
        if (!review && $currentUser && job.winnerFreelancer === $currentUser.pubkey) {
            return true;
        }
        return false;
    });

    // Effect to fetch winner bid
    $effect(() => {
        if (!job.acceptedBidAddress) return;

        $ndk.fetchEvent(job.acceptedBidAddress, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((event) => {
            if (event) {
                winnerBid = BidEvent.from(event);
            }
        });
    });

    function handleShare() {
        showShareModal = true;
    }

    function handleEdit() {
        if (job) {
            $jobToEdit = job;

            goto('/post-job');
        }
    }

    function handleCloseJob() {
        showCloseJobModal = true;
    }

    function handlePay() {
        if (!winnerBid) return;

        $paymentDetail = {
            job: job,
            bid: winnerBid,
        };

        showPaymentModal = true;
    }

    function goToChat() {
        const url = new URL('/messages/' + bech32ID, window.location.origin);
        if ($currentUser && $currentUser.pubkey !== job.pubkey) {
            url.searchParams.append(SELECTED_QUERY_PARAM, job.pubkey);
        } else if (job.winnerFreelancer) {
            url.searchParams.append(SELECTED_QUERY_PARAM, job.winnerFreelancer);
        }
        goto(url.toString());
    }

    function handleReviewClient() {
        showReviewClientModal = true;
    }

    function handlePreviewReview() {
        showReviewModal = true;
    }

    const btnClasses =
        'bg-black-100 text-black-500 dark:text-white dark:bg-white-100 scale-100 w-auto grow justify-start';
</script>

<div class="flex flex-col grow-1 gap-[10px] p-[0px]">
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <Button classes={btnClasses} onClick={handleShare}>
            <i class="bx bxs-share"></i>
            Share
        </Button>

        {#if myJob && job.status === JobStatus.New}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handleEdit}>
                <i class="bx bxs-edit-alt text-[20px]"></i>
                <p class="">Edit</p>
            </Button>
        {/if}

        {#if myJob && (job.status === JobStatus.New || job.status === JobStatus.InProgress)}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handleCloseJob}>
                <i class="bx bxs-lock text-[20px]"></i>
                <p class="">Close Job</p>
            </Button>
        {/if}

        {#if myJob && job.status !== JobStatus.New && winnerBid}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handlePay}>
                <i class="bx bxs-bolt text-[20px]"></i>
                <p class="">Pay</p>
            </Button>
        {/if}

        {#if showMessageButton && bech32ID}
            <Button onClick={goToChat} variant="outlined" classes={btnClasses} fullWidth>
                <i class="bx bxs-conversation"></i>
                <p class="">Message</p>
            </Button>
        {/if}

        {#if canReviewClient}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handleReviewClient}>
                <i class="bx bxs-star text-[20px]"></i>
                <p class="">Review Client</p>
            </Button>
        {:else if review}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handlePreviewReview}>
                <i class="bx bxs-star text-[20px]"></i>
                <p class="">Preview Review</p>
            </Button>
        {/if}
    </div>
</div>

<ShareJobModal bind:isOpen={showShareModal} {job} />

<CloseJobModal bind:isOpen={showCloseJobModal} {job} bid={winnerBid} />

<ReviewClientModal bind:isOpen={showReviewClientModal} jobAddress={job.jobAddress} />

<PaymentModal bind:isOpen={showPaymentModal} />

<ReviewModal bind:isOpen={showReviewModal} review={review!} />
