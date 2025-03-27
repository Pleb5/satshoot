<script lang="ts">
    import { TicketStatus, type TicketEvent } from '$lib/events/TicketEvent';
    import currentUser from '$lib/stores/user';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import ShareJobModal from './ShareJobModal.svelte';
    import CloseJobModal from './CloseJobModal.svelte';
    import ndk from '$lib/stores/ndk';
    import { onMount } from 'svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import ReviewClientModal from './ReviewClientModal.svelte';
    import { clientReviews } from '$lib/stores/reviews';
    import { offerMakerToSelect, selectedPerson } from '$lib/stores/messages';
    import { paymentDetail } from '$lib/stores/payment';
    import PaymentModal from './PaymentModal.svelte';
    import { jobToEdit } from '$lib/stores/job-to-edit';
    import { goto } from '$app/navigation';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';

    const modalStore = getModalStore();

    interface Props {
        job: TicketEvent;
    }

    let { job }: Props = $props();

    const bech32ID = $derived(job.encode());

    const myJob = $derived($currentUser?.pubkey === job.pubkey);
    const isWinner = $derived($currentUser?.pubkey === job.winnerFreelancer);
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

    // Reactive states
    let winnerOffer = $state<OfferEvent | null>(null);

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

    function selectChatPartner() {
        if ($currentUser && $currentUser.pubkey !== job.pubkey) {
            $selectedPerson = job.pubkey + '$' + bech32ID;
        } else if (job.winnerFreelancer) {
            $offerMakerToSelect = job.winnerFreelancer;
        }

        modalStore.close();
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

    function handleEdit() {
        if (job) {
            $jobToEdit = job;

            goto('/post-job');
            modalStore.clear();
        }
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
</script>

{#if $modalStore[0]}
    <Popup title="Job Menu">
        <div class="w-full flex flex-col">
            <!-- popups Job-Post-Menu start -->
            <div class="w-full py-[10px] px-[5px] flex flex-col gap-[10px]">
                <Button variant="outlined" classes="justify-start" fullWidth on:click={handleShare}>
                    <i class="bx bxs-share text-[20px]"></i>
                    <p class="">Share</p>
                </Button>

                {#if myJob && job.status === TicketStatus.New}
                    <Button
                        variant="outlined"
                        classes="justify-start"
                        fullWidth
                        on:click={handleEdit}
                    >
                        <i class="bx bxs-edit-alt text-[20px]"></i>
                        <p class="">Edit</p>
                    </Button>
                {/if}

                {#if myJob && (job.status === TicketStatus.New || job.status === TicketStatus.InProgress)}
                    <Button
                        variant="outlined"
                        classes="justify-start"
                        fullWidth
                        on:click={handleCloseJob}
                    >
                        <i class="bx bxs-lock text-[20px]"></i>
                        <p class="">Close Job</p>
                    </Button>
                {/if}

                {#if myJob && job.status !== TicketStatus.New && winnerOffer}
                    <Button
                        variant="outlined"
                        classes="justify-start"
                        fullWidth
                        on:click={handlePay}
                    >
                        <i class="bx bxs-bolt text-[20px]"></i>
                        <p class="">Pay</p>
                    </Button>
                {/if}

                {#if showMessageButton && bech32ID}
                    <Button
                        href={'/messages/' + bech32ID}
                        on:click={selectChatPartner}
                        variant="outlined"
                        classes="justify-start"
                        fullWidth
                    >
                        <i class="bx bxs-conversation"></i>
                        <p class="">Message</p>
                    </Button>
                {/if}

                {#if canReviewClient}
                    <Button
                        variant="outlined"
                        classes="justify-start"
                        fullWidth
                        on:click={handleReviewClient}
                    >
                        <i class="bx bxs-star text-[20px]"></i>
                        <p class="">Review Client</p>
                    </Button>
                {:else if review}
                    <Button
                        variant="outlined"
                        classes="justify-start"
                        fullWidth
                        on:click={handlePreviewReview}
                    >
                        <i class="bx bxs-star text-[20px]"></i>
                        <p class="">Preview Review</p>
                    </Button>
                {/if}
            </div>
            <!-- popups Job-Post-Menu end -->
        </div>
    </Popup>
{/if}
