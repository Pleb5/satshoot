<script lang="ts">
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewEvent, type FreelancerRating } from '$lib/events/ReviewEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { paymentDetail } from '$lib/stores/payment';
    import {
        getModalStore,
        getToastStore,
        ProgressRadial,
        type ModalComponent,
        type ModalSettings,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import { tick } from 'svelte';
    import ReviewToggleQuestion from '../UI/Buttons/ReviewToggleQuestion.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Popup from '../UI/Popup.svelte';
    import PaymentModal from './PaymentModal.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let job: TicketEvent;
    export let offer: OfferEvent | null = null;

    let expertise = false;
    let availability = false;
    let communication = false;

    let isIssueResolved = true;
    let reviewText = '';
    let closing = false;
    let errorMessage = '';

    async function closeJob() {
        if (job) {
            const jobToPublish = new TicketEvent($ndk);
            jobToPublish.tags = job.tags;
            jobToPublish.description = job.description;
            // Important part! This also sets status to in progress
            jobToPublish.status = isIssueResolved ? TicketStatus.Resolved : TicketStatus.Failed;

            try {
                closing = true;
                console.log('connected relays before closing job:', $ndk.pool.connectedRelays());
                await tick();

                const relays = await jobToPublish.publish();

                console.log('published relays', relays);

                // Post review data if applicable
                if (job.acceptedOfferAddress) {
                    const reviewEvent = new ReviewEvent($ndk);
                    reviewEvent.reviewedEventAddress = job.acceptedOfferAddress;

                    const rating: FreelancerRating = {
                        success: isIssueResolved,
                        expertise,
                        availability,
                        communication,
                        reviewText,
                    };

                    reviewEvent.freelancerRatings = rating;

                    console.log('review event:', reviewEvent);
                    const relays = await reviewEvent.publish();
                    console.log('published relays', relays);
                }

                // const closedToast: ToastSettings = {
                //     message: 'Ticket Closed!',
                //     timeout: 7000,
                //     background: 'bg-success-300-600-token',
                // };
                // toastStore.trigger(closedToast);
                //
                // const checkWallet: ToastSettings = {
                //     message: 'Check your Wallet to make sure the Payment is complete!',
                //     autohide: false,
                //     background: 'bg-warning-300-600-token',
                // };
                // toastStore.trigger(checkWallet);

                // Close this modal and Open payment modal
                modalStore.close();

                if (offer) {
                    $paymentDetail = {
                        ticket: job,
                        offer,
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
            } catch (e) {
                console.log(e);
                closing = false;
                errorMessage = 'Error while closing: ' + e;
            }
        } else {
            closing = false;
            const t: ToastSettings = {
                message: 'Error: Could could not find job to close!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
            modalStore.close();
        }
    }
</script>

{#if $modalStore[0]}
    <Popup title="Close Job?">
        <div class="w-full flex flex-col">
            <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                <ReviewToggleQuestion
                    question="Was Your Issue Resolved?"
                    bind:value={isIssueResolved}
                    trueLabel="Yes"
                    falseLabel="No"
                />
                {#if job.acceptedOfferAddress}
                    {#if isIssueResolved}
                        <div class="w-full flex flex-col gap-[5px]">
                            <div class="w-full max-h-[50vh] overflow-auto">
                                <p class="w-full">
                                    Select excellent qualities of the Freelancer, if any:
                                </p>
                            </div>
                            <div class="w-full py-[10px] px-[5px] flex flex-col gap-[10px]">
                                <Checkbox
                                    id="expertise"
                                    label="A skilled expert"
                                    bind:checked={expertise}
                                />
                                <Checkbox
                                    id="availability"
                                    label="Highly available, attentive and responsive"
                                    bind:checked={availability}
                                />
                                <Checkbox
                                    id="communication"
                                    label="Especially clear and kind communication"
                                    bind:checked={communication}
                                />
                            </div>
                        </div>
                    {/if}

                    <div class="w-full flex flex-col gap-[5px]">
                        <div class="w-full max-h-[50vh] overflow-auto">
                            <p class="w-full">Share your experience to help others:</p>
                        </div>
                        <Input
                            bind:value={reviewText}
                            placeholder="Describe your experience..."
                            classes="min-h-[100px]"
                            fullWidth
                            textarea
                        />
                    </div>
                {/if}

                <div class="w-full flex flex-row gap-[10px]">
                    <Button grow on:click={closeJob} disabled={closing}>
                        {#if closing}
                            <span>
                                <ProgressRadial
                                    value={undefined}
                                    stroke={60}
                                    meter="stroke-error-500"
                                    track="stroke-error-500/30"
                                    strokeLinecap="round"
                                    width="w-8"
                                />
                            </span>
                        {:else}
                            <span class="font-bold">
                                {'Close job' + (offer ? ' and Pay' : '')}
                            </span>
                        {/if}
                    </Button>
                </div>
            </div>
            <!-- popups Job-Close end -->
        </div>
    </Popup>
{/if}
