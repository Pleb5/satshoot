<script lang="ts">
    import ndk from '$lib/stores/session';
    import { tick } from 'svelte';
    import ReviewToggleQuestion from '../UI/Buttons/ReviewToggleQuestion.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import PaymentModal from './PaymentModal.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
    import { BidEvent } from '$lib/events/BidEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { ReviewEvent } from '$lib/events/ReviewEvent';

    interface Props {
        isOpen: boolean;
        targetEntity: JobEvent | OrderEvent;
        secondaryEntity?: BidEvent | ServiceEvent | null;
    }

    let { isOpen = $bindable(), targetEntity, secondaryEntity = null }: Props = $props();

    let isPaymentModalOpen = $state(false);
    let hasExpertise = $state(false);
    let hasCommunicationClarity = $state(false);
    let isIssueResolved = $state(true);
    let reviewText = $state('');
    let isClosing = $state(false);

    const reviewTargetAddress = $derived.by(() => {
        if (isJob(targetEntity)) return targetEntity.acceptedBidAddress;

        // we need to allow the user to post a review on service only when
        // freelancer had accepted the order
        if (
            secondaryEntity instanceof ServiceEvent &&
            secondaryEntity.orders.includes(targetEntity.orderAddress)
        )
            return targetEntity.referencedServiceAddress;

        return '';
    });

    const jobOrService = $derived.by(() => {
        if (targetEntity instanceof JobEvent) return targetEntity;
        else if (secondaryEntity instanceof ServiceEvent) return secondaryEntity;
    });

    const bidOrOrder = $derived.by(() => {
        if (targetEntity instanceof OrderEvent) return targetEntity;
        else if (secondaryEntity instanceof BidEvent) return secondaryEntity;
    });

    $effect(() => {
        if (!isIssueResolved) {
            hasExpertise = false;
            hasCommunicationClarity = false;
        }
    });

    function isJob(entity: JobEvent | OrderEvent): entity is JobEvent {
        return targetEntity instanceof JobEvent;
    }

    function updateTargetEntityStatus() {
        if (!targetEntity) return;
        targetEntity.status = isIssueResolved
            ? isJob(targetEntity)
                ? JobStatus.Resolved
                : OrderStatus.Fulfilled
            : isJob(targetEntity)
              ? JobStatus.Failed
              : OrderStatus.Failed;
    }

    async function publishReplacementEvent() {
        if (!targetEntity) return;
        console.log('connected relays before closing entity:', $ndk.pool.connectedRelays());
        await tick();

        const newEvent = isJob(targetEntity) ? new JobEvent($ndk) : new OrderEvent($ndk);
        newEvent.tags = targetEntity.tags;
        newEvent.description = targetEntity.description;
        const relays = await newEvent.publish();
        console.log('published relays', relays);
        return relays;
    }

    async function publishReviewIfNeeded() {
        if (!reviewTargetAddress) return;
        const reviewEvent = new ReviewEvent($ndk);
        reviewEvent.reviewedEventAddress = reviewTargetAddress;
        reviewEvent.freelancerRatings = {
            success: isIssueResolved,
            expertise: hasExpertise,
            communication: hasCommunicationClarity,
            reviewText,
        };
        console.log('review event:', reviewEvent);
        const relaysReview = await reviewEvent.publish();
        console.log('published relays', relaysReview);
        return relaysReview;
    }

    function handlePostClosePayment() {
        if (!secondaryEntity) return;

        if (secondaryEntity instanceof BidEvent) {
            isPaymentModalOpen = true;
            return;
        }

        if (
            targetEntity instanceof OrderEvent &&
            secondaryEntity.orders.includes(targetEntity.orderAddress)
        ) {
            isPaymentModalOpen = true;
            return;
        }
    }

    function handleCloseEntityError(err: unknown) {
        console.log(err);
        isClosing = false;
        toaster.error({
            title: 'Error while closing',
            description: err instanceof Error ? err.message : String(err),
        });
    }

    function handleMissingEntity() {
        isClosing = false;
        toaster.error({ title: 'Could not find entity to close!' });
        isOpen = false;
    }

    async function closeEntity() {
        if (!targetEntity) {
            handleMissingEntity();
            return;
        }
        try {
            isClosing = true;
            updateTargetEntityStatus();
            await publishReplacementEvent();
            await publishReviewIfNeeded();
            isOpen = false;
            handlePostClosePayment();
        } catch (err) {
            handleCloseEntityError(err);
        }
    }
</script>

<ModalWrapper bind:isOpen title={`Close ${isJob(targetEntity) ? 'Job' : 'Order'}?`}>
    <div class="w-full flex flex-col">
        <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
            <ReviewToggleQuestion
                question="Was Your Issue Resolved?"
                bind:value={isIssueResolved}
                trueLabel="Yes"
                falseLabel="No"
            />
            {#if reviewTargetAddress}
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
                                bind:checked={hasExpertise}
                            />
                            <Checkbox
                                id="communication"
                                label="Especially clear and kind communication"
                                bind:checked={hasCommunicationClarity}
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
                <Button grow onClick={closeEntity} disabled={isClosing}>
                    {#if isClosing}
                        <span>
                            <ProgressRing />
                        </span>
                    {:else}
                        <span class="font-bold">
                            {`Close ${isJob(targetEntity) ? 'Job' : 'Order'}` +
                                (reviewTargetAddress ? ' and Pay' : '')}
                        </span>
                    {/if}
                </Button>
            </div>
        </div>
        <!-- popups Entity-Close end -->
    </div>
</ModalWrapper>

{#if jobOrService && bidOrOrder}
    <PaymentModal
        bind:isOpen={isPaymentModalOpen}
        targetEntity={jobOrService}
        secondaryEntity={bidOrOrder}
    />
{/if}
