<script lang="ts">
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import ShareJobModal from '../Modals/ShareJobModal.svelte';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import currentUser from '$lib/stores/user';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
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

    const modalStore = getModalStore();

    export let job: TicketEvent;

    let bech32ID = '';
    let myJob = false;
    let canReviewClient = false;
    let review: ReviewEvent | undefined = undefined;
    let winnerOffer: OfferEvent | null = null;
    let showMessageButton = false;

    $: if (job) {
        bech32ID = job.encode();
    }

    $: if ($currentUser && job && $currentUser.pubkey === job.pubkey) {
        myJob = true;
    } else {
        myJob = false;
    }

    $: if ($clientReviews) {
        review = $clientReviews.find((review) => review.reviewedEventAddress === job.ticketAddress);

        // check if there's a review on job then it can't be reviewed again
        if (review) {
            canReviewClient = false;
        }
        // check if the current user is the job winner then he can review the client
        else if ($currentUser && job.winnerFreelancer === $currentUser.pubkey) {
            canReviewClient = true;
        }
    }

    $: if (job.acceptedOfferAddress) {
        $ndk.fetchEvent(job.acceptedOfferAddress, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((event) => {
            if (event) {
                winnerOffer = OfferEvent.from(event);
            }
        });
    }

    $: if ($currentUser && (myJob || job.winnerFreelancer === $currentUser.pubkey)) {
        showMessageButton = true;
    } else {
        showMessageButton = false;
    }

    function handleShare() {
        const modalComponent: ModalComponent = {
            ref: ShareJobModal,
            props: { job },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }

    function handleEdit() {
        if (job) {
            $jobToEdit = job;

            goto('/post-job');
        }
    }

    function handleCloseJob() {
        const modalComponent: ModalComponent = {
            ref: CloseJobModal,
            props: { job, offer: winnerOffer },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }

    function handlePay() {
        if (!winnerOffer) return;

        $paymentDetail = {
            ticket: job,
            offer: winnerOffer,
        };

        const modalComponent: ModalComponent = {
            ref: PaymentModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }

    function selectChatPartner() {
        if ($currentUser && $currentUser.pubkey !== job.pubkey) {
            $selectedPerson = job.pubkey + '$' + bech32ID;
        } else if (job.winnerFreelancer) {
            $offerMakerToSelect = job.winnerFreelancer;
        }
    }

    function handleReviewClient() {
        const modalComponent: ModalComponent = {
            ref: ReviewClientModal,
            props: { jobAddress: job.ticketAddress },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }

    function handlePreviewReview() {
        const modalComponent: ModalComponent = {
            ref: ReviewModal,
            props: { review },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }

    const btnClasses =
        'bg-black-100 text-black-500 dark:text-white dark:bg-white-100 scale-[1] w-auto flex-grow justify-start';
</script>

<div class="flex flex-col grow-[1] gap-[10px] p-[0px]">
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <Button classes={btnClasses} on:click={handleShare}>
            <i class="bx bxs-share" />
            Share
        </Button>

        {#if myJob && job.status === TicketStatus.New}
            <Button variant="outlined" classes={btnClasses} fullWidth on:click={handleEdit}>
                <i class="bx bxs-edit-alt text-[20px]"></i>
                <p class="">Edit</p>
            </Button>
        {/if}

        {#if myJob && (job.status === TicketStatus.New || job.status === TicketStatus.InProgress)}
            <Button variant="outlined" classes={btnClasses} fullWidth on:click={handleCloseJob}>
                <i class="bx bx-x-circle text-[20px]"></i>
                <p class="">Close Job</p>
            </Button>
        {/if}

        {#if myJob && job.status !== TicketStatus.New && winnerOffer}
            <Button variant="outlined" classes={btnClasses} fullWidth on:click={handlePay}>
                <i class="bx bxs-bolt text-[20px]"></i>
                <p class="">Pay</p>
            </Button>
        {/if}

        {#if showMessageButton && bech32ID}
            <Button
                href={'/messages/' + bech32ID}
                on:click={selectChatPartner}
                variant="outlined"
                classes={btnClasses}
                fullWidth
            >
                <i class="bx bxs-conversation" />
                <p class="">Message</p>
            </Button>
        {/if}

        {#if canReviewClient}
            <Button variant="outlined" classes={btnClasses} fullWidth on:click={handleReviewClient}>
                <i class="bx bxs-star text-[20px]"></i>
                <p class="">Review Client</p>
            </Button>
        {:else if review}
            <Button
                variant="outlined"
                classes={btnClasses}
                fullWidth
                on:click={handlePreviewReview}
            >
                <i class="bx bxs-star text-[20px]"></i>
                <p class="">Preview Review</p>
            </Button>
        {/if}
    </div>
</div>
