<script lang="ts">
    import { TicketStatus, type TicketEvent } from '$lib/events/TicketEvent';
    import currentUser from '$lib/stores/user';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import ShareJobModal from './ShareJobModal.svelte';
    import CloseJobModal from './CloseJobModal.svelte';
    import ndk from '$lib/stores/ndk';
    import { onMount } from 'svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import NewReviewClientModal from './NewReviewClientModal.svelte';
    import { clientReviews } from '$lib/stores/reviews';
    import { offerMakerToSelect, selectedPerson } from '$lib/stores/messages';
    import { paymentDetail } from '$lib/stores/payment';
    import PaymentModal from './PaymentModal.svelte';
    import { ticketToEdit } from '$lib/stores/ticket-to-edit';
    import { goto } from '$app/navigation';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalHeader from '../UI/Modal/ModalHeader.svelte';

    const modalStore = getModalStore();

    export let job: TicketEvent;

    let bech32ID = '';
    $: if (job) {
        bech32ID = job.encode();
    }

    let myJob = false;
    $: if ($currentUser && job && $currentUser.pubkey === job.pubkey) {
        myJob = true;
    } else {
        myJob = false;
    }

    let isWinner = false;
    $: if ($currentUser && job.winnerFreelancer === $currentUser.pubkey) {
        isWinner = true;
    } else {
        isWinner = false;
    }

    let canReviewClient = false;
    $: if (isWinner && $clientReviews) {
        const hasAlreadyReviewed = $clientReviews.some(
            (review) => review.reviewedEventAddress === job.ticketAddress
        );

        if (hasAlreadyReviewed) {
            canReviewClient = false;
        } else {
            canReviewClient = true;
        }
    }

    let showMessageButton = false;
    $: if ($currentUser && (!myJob || job.acceptedOfferAddress)) {
        showMessageButton = true;
    } else {
        showMessageButton = false;
    }

    let winnerOffer: OfferEvent | null = null;

    onMount(async () => {
        if (job.acceptedOfferAddress) {
            const winnerOfferEvent = await $ndk.fetchEvent(job.acceptedOfferAddress);
            if (winnerOfferEvent) {
                winnerOffer = OfferEvent.from(winnerOfferEvent);
            }
        }
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
            ref: NewReviewClientModal,
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
        if (job.pubkey !== $currentUser!.pubkey) {
            $selectedPerson = job.pubkey + '$' + bech32ID;
        } else if (job.acceptedOfferAddress) {
            $offerMakerToSelect = job.winnerFreelancer as string;
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
            $ticketToEdit = job;

            goto('/post-job');
            modalStore.clear();
        }
    }
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <Card>
                        <ModalHeader title="Job Menu" />
                        <div class="w-full flex flex-col">
                            <!-- popups Job-Post-Menu start -->
                            <div class="w-full py-[10px] px-[5px] flex flex-col gap-[10px]">
                                <Button
                                    variant="outlined"
                                    classes="justify-start"
                                    fullWidth
                                    on:click={handleShare}
                                >
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
                                        <i class="bx bx-window-close text-[20px]"></i>
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
                                        <i class="bx bx-window-close text-[20px]"></i>
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
                                        <i class="bx bxs-conversation" />
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
                                        <i class="bx bx-window-close text-[20px]"></i>
                                        <p class="">Review Client</p>
                                    </Button>
                                {/if}
                            </div>
                            <!-- popups Job-Post-Menu end -->
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
