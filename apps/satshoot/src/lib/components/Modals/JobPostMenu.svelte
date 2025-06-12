<script lang="ts">
    import { JobStatus, type JobEvent } from '$lib/events/JobEvent';
    import currentUser from '$lib/stores/user';
    import ShareEventModal from './ShareEventModal.svelte';
    import ndk from '$lib/stores/session';
    import { BidEvent } from '$lib/events/BidEvent';
    import ReviewClientModal from './ReviewClientModal.svelte';
    import { clientReviews } from '$lib/stores/reviews';
    import PaymentModal from './PaymentModal.svelte';
    import { jobToEdit } from '$lib/stores/job-to-edit';
    import { goto } from '$app/navigation';
    import Button from '../UI/Buttons/Button.svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import CloseEntityModal from './CloseEntityModal.svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';

    interface Props {
        isOpen: boolean;
        job: JobEvent;
    }

    let { isOpen = $bindable(), job }: Props = $props();

    let showShareModal = $state(false);
    let showCloseJobModal = $state(false);
    let showReviewClientModal = $state(false);
    let showPaymentModal = $state(false);
    let showReviewModal = $state(false);

    const bech32ID = $derived(job.encode());

    const myJob = $derived($currentUser?.pubkey === job.pubkey);
    const isWinner = $derived($currentUser?.pubkey === job.winnerFreelancer);
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

    // Reactive states
    let winnerBid = $state<BidEvent | null>(null);

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
        isOpen = false;
        showShareModal = true;
    }

    function handleCloseJob() {
        isOpen = false;
        showCloseJobModal = true;
    }

    function handleReviewClient() {
        isOpen = false;
        showReviewClientModal = true;
    }

    function goToChat() {
        const url = new URL('/messages/' + bech32ID);
        if ($currentUser && $currentUser.pubkey !== job.pubkey) {
            url.searchParams.append(SELECTED_QUERY_PARAM, job.pubkey);
        } else if (job.winnerFreelancer) {
            url.searchParams.append(SELECTED_QUERY_PARAM, job.winnerFreelancer);
        }

        goto(url);

        isOpen = false;
    }

    function handlePay() {
        if (!winnerBid) return;

        isOpen = false;
        showPaymentModal = true;
    }

    function handleEdit() {
        if (job) {
            $jobToEdit = job;

            goto('/post-job');
            isOpen = false;
        }
    }

    function handlePreviewReview() {
        isOpen = false;
        showReviewModal = true;
    }
</script>

<ModalWrapper bind:isOpen title="Job Menu">
    <div class="w-full flex flex-col">
        <!-- popups Job-Post-Menu start -->
        <div class="w-full py-[10px] px-[5px] flex flex-col gap-[10px]">
            <Button variant="outlined" classes="justify-start" fullWidth onClick={handleShare}>
                <i class="bx bxs-share text-[20px]"></i>
                <p class="">Share</p>
            </Button>

            {#if myJob && job.status === JobStatus.New}
                <Button variant="outlined" classes="justify-start" fullWidth onClick={handleEdit}>
                    <i class="bx bxs-edit-alt text-[20px]"></i>
                    <p class="">Edit</p>
                </Button>
            {/if}

            {#if myJob && (job.status === JobStatus.New || job.status === JobStatus.InProgress)}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    fullWidth
                    onClick={handleCloseJob}
                >
                    <i class="bx bxs-lock text-[20px]"></i>
                    <p class="">Close Job</p>
                </Button>
            {/if}

            {#if myJob && job.status !== JobStatus.New && winnerBid}
                <Button variant="outlined" classes="justify-start" fullWidth onClick={handlePay}>
                    <i class="bx bxs-bolt text-[20px]"></i>
                    <p class="">Pay</p>
                </Button>
            {/if}

            {#if showMessageButton && bech32ID}
                <Button onClick={goToChat} variant="outlined" classes="justify-start" fullWidth>
                    <i class="bx bxs-conversation"></i>
                    <p class="">Message</p>
                </Button>
            {/if}

            {#if canReviewClient}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    fullWidth
                    onClick={handleReviewClient}
                >
                    <i class="bx bxs-star text-[20px]"></i>
                    <p class="">Review Client</p>
                </Button>
            {:else if review}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    fullWidth
                    onClick={handlePreviewReview}
                >
                    <i class="bx bxs-star text-[20px]"></i>
                    <p class="">Preview Review</p>
                </Button>
            {/if}
        </div>
        <!-- popups Job-Post-Menu end -->
    </div>
</ModalWrapper>

<ShareEventModal bind:isOpen={showShareModal} eventObj={job} />

<CloseEntityModal bind:isOpen={showCloseJobModal} targetEntity={job} secondaryEntity={winnerBid} />

<ReviewClientModal bind:isOpen={showReviewClientModal} eventAddress={job.jobAddress} />

{#if winnerBid}
    <PaymentModal bind:isOpen={showPaymentModal} targetEntity={job} secondaryEntity={winnerBid} />
{/if}

<ReviewModal bind:isOpen={showReviewModal} review={review!} />
