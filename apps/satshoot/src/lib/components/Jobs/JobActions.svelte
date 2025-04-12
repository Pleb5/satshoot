<script lang="ts">
    import Button from '../UI/Buttons/Button.svelte';
    import ShareJobModal from '../Modals/ShareJobModal.svelte';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import currentUser from '$lib/stores/user';
    import { clientReviews } from '$lib/stores/reviews';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import ndk from '$lib/stores/ndk';
    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { jobToEdit } from '$lib/stores/job-to-edit';
    import { goto } from '$app/navigation';
    import CloseJobModal from '../Modals/CloseJobModal.svelte';
    import { paymentDetail } from '$lib/stores/payment';
    import PaymentModal from '../Modals/PaymentModal.svelte';
    import { offerMakerToSelect, selectedPerson } from '$lib/stores/messages';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import ReviewClientModal from '../Modals/ReviewClientModal.svelte';

    interface Props {
        job: TicketEvent;
    }

    let { job }: Props = $props();

    // Reactive states
    let winnerOffer = $state<OfferEvent | null>(null);
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
        $clientReviews.find((review) => review.reviewedEventAddress === job.ticketAddress)
    );

    const canReviewClient = $derived.by(() => {
        if (!review && $currentUser && job.winnerFreelancer === $currentUser.pubkey) {
            return true;
        }
        return false;
    });

    // Effect to fetch winner offer
    $effect(() => {
        if (!job.acceptedOfferAddress) return;

        $ndk.fetchEvent(job.acceptedOfferAddress, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((event) => {
            if (event) {
                winnerOffer = OfferEvent.from(event);
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
        if (!winnerOffer) return;

        $paymentDetail = {
            ticket: job,
            offer: winnerOffer,
        };

        showPaymentModal = true;
    }

    function selectChatPartner() {
        if ($currentUser && $currentUser.pubkey !== job.pubkey) {
            $selectedPerson = job.pubkey + '$' + bech32ID;
        } else if (job.winnerFreelancer) {
            $offerMakerToSelect = job.winnerFreelancer;
        }
    }

    function handleReviewClient() {
        showReviewClientModal = true;
    }

    function handlePreviewReview() {
        showReviewModal = true;
    }

    const btnClasses =
        'bg-black-100 text-black-500 dark:text-white dark:bg-white-100 scale-1 w-auto grow justify-start';
</script>

<div class="flex flex-col grow-1 gap-[10px] p-[0px]">
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <Button classes={btnClasses} onClick={handleShare}>
            <i class="bx bxs-share"></i>
            Share
        </Button>

        {#if myJob && job.status === TicketStatus.New}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handleEdit}>
                <i class="bx bxs-edit-alt text-[20px]"></i>
                <p class="">Edit</p>
            </Button>
        {/if}

        {#if myJob && (job.status === TicketStatus.New || job.status === TicketStatus.InProgress)}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handleCloseJob}>
                <i class="bx bxs-lock text-[20px]"></i>
                <p class="">Close Job</p>
            </Button>
        {/if}

        {#if myJob && job.status !== TicketStatus.New && winnerOffer}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handlePay}>
                <i class="bx bxs-bolt text-[20px]"></i>
                <p class="">Pay</p>
            </Button>
        {/if}

        {#if showMessageButton && bech32ID}
            <Button
                href={'/messages/' + bech32ID}
                onClick={selectChatPartner}
                variant="outlined"
                classes={btnClasses}
                fullWidth
            >
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

<CloseJobModal bind:isOpen={showCloseJobModal} {job} offer={winnerOffer} />

<ReviewClientModal bind:isOpen={showReviewClientModal} jobAddress={job.ticketAddress} />

<PaymentModal bind:isOpen={showPaymentModal} />

<ReviewModal bind:isOpen={showReviewModal} review={review!} />
