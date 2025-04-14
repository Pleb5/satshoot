<script lang="ts">
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewEvent, type FreelancerRating } from '$lib/events/ReviewEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { paymentDetail } from '$lib/stores/payment';

    import { tick } from 'svelte';
    import ReviewToggleQuestion from '../UI/Buttons/ReviewToggleQuestion.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import PaymentModal from './PaymentModal.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
        job: TicketEvent;
        offer?: OfferEvent | null;
    }

    let { isOpen = $bindable(), job, offer = null }: Props = $props();

    let showPaymentModal = $state(false);

    let expertise = $state(false);
    let availability = $state(false);
    let communication = $state(false);

    let isIssueResolved = $state(true);
    let reviewText = $state('');
    let closing = $state(false);
    let errorMessage = '';

    $effect(() => {
        if (!isIssueResolved) {
            expertise = availability = communication = false;
        }
    });

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

                // Close this modal and Open payment modal
                isOpen = false;

                if (offer) {
                    $paymentDetail = {
                        ticket: job,
                        offer,
                    };

                    isOpen = false;
                    showPaymentModal = true;
                }
            } catch (e) {
                console.log(e);
                closing = false;
                errorMessage = 'Error while closing: ' + e;
            }
        } else {
            closing = false;
            toaster.error({ title: 'Could could not find job to close!' });

            isOpen = false;
        }
    }
</script>

<ModalWrapper bind:isOpen title="Close Job?">
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
                <Button grow onClick={closeJob} disabled={closing}>
                    {#if closing}
                        <span>
                            <ProgressRing color="error" />
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
</ModalWrapper>

<PaymentModal bind:isOpen={showPaymentModal} />
