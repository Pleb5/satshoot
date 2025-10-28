<script lang="ts">
    import ndk from '$lib/stores/session';
    import { tick } from 'svelte';
    import ReviewToggleQuestion from '../UI/Buttons/ReviewToggleQuestion.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
    import { BidEvent } from '$lib/events/BidEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { ReviewEvent } from '$lib/events/ReviewEvent';
    import { goto } from '$app/navigation';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';
    interface Props {
        isOpen: boolean;
        targetEntity: JobEvent | ServiceEvent;
        secondaryEntity?: BidEvent | OrderEvent | null;
    }

    let { isOpen = $bindable(), targetEntity, secondaryEntity = null }: Props = $props();

    let isJob = $derived(targetEntity?.kind === ExtendedNDKKind.FreelanceJob);

    let targetEntityClone: JobEvent | ServiceEvent | undefined = undefined;
    let secondaryEntityClone: BidEvent | OrderEvent | null | undefined = undefined;
    let reviewTargetAddress = $state<string>('')

    $effect(() => {
        if (isOpen && !targetEntityClone && targetEntity) {
            console.log('isOpen effect')
            if (isJob) {
                console.log('isJob effect')
                targetEntityClone = JobEvent.from(targetEntity)
                if (secondaryEntity === null) {
                    secondaryEntityClone = null
                    reviewTargetAddress = ''
                } else {
                    secondaryEntityClone = BidEvent.from(secondaryEntity)
                    reviewTargetAddress = targetEntityClone.acceptedBidAddress as string
                }

            } else {
                console.log('isService effect')
                targetEntityClone = ServiceEvent.from(targetEntity)
                if (!secondaryEntity) {
                    throw new Error('BUG:Trying to close a non-existing Order!')
                }

                secondaryEntityClone = OrderEvent.from(secondaryEntity) 

                console.log('targetEntityClone orders:', targetEntityClone.orders)
                console.log('secondaryEntityClone ordersAddress:', secondaryEntityClone.orderAddress)
                if (targetEntityClone.orders.includes(secondaryEntityClone.orderAddress)) {
                    reviewTargetAddress = targetEntityClone.serviceAddress
                }
                console.log('reviewTargetAddress', reviewTargetAddress)
        
                console.log('service cloned:', targetEntityClone)
                console.log('Order cloned:', secondaryEntityClone)
            }
        } else if (!isOpen) {
            console.log('NOT isOpen effect')
            targetEntityClone = undefined
            secondaryEntityClone = undefined
            reviewTargetAddress = ''
        }
    })

    let hasExpertise = $state(false);
    let hasCommunicationClarity = $state(false);
    let isIssueResolved = $state(true);
    let reviewText = $state('');
    let isClosing = $state(false);


    $effect(() => {
        if (!isIssueResolved) {
            hasExpertise = false;
            hasCommunicationClarity = false;
        }
    });

    let canPublishReplaceable = $derived(
        isJob ? !!targetEntityClone : !!secondaryEntityClone
    );

    function updateTargetEntityStatus() {
        if (!targetEntityClone) return;

        if (isJob) {
            updateJobStatus(targetEntityClone as JobEvent);
        } else {
            updateOrderStatus(secondaryEntityClone as OrderEvent);
        }
    }

    function updateJobStatus(job: JobEvent) {
        const oldStatus = job.status;
        const newStatus = isIssueResolved ? JobStatus.Resolved : JobStatus.Failed;

        job.status = newStatus;
        if (oldStatus !== newStatus) {
            job.addStateHistory(oldStatus);
        }
    }

    function updateOrderStatus(order: OrderEvent) {
        const oldStatus = order.status;
        const newStatus = isIssueResolved ? OrderStatus.Fulfilled : OrderStatus.Failed;

        order.status = newStatus;
        if (oldStatus !== newStatus) {
            order.addStateHistory(oldStatus);
        }
    }

    async function publishReplacementEvent() {
        if (!canPublishReplaceable) return;

        try {
            const entityToPublish = isJob ? targetEntityClone : secondaryEntityClone;
            console.log('publishing event : ', entityToPublish);

            const relays = await entityToPublish!.publishReplaceable();
            console.log('relays published to', relays);

            return relays;
        } catch (e) {
            toaster.error({ title: `Error while closing: ${e}` });
        }
    }

    async function publishReviewIfNeeded() {
        if (!reviewTargetAddress) return;
        const reviewEvent = new ReviewEvent($ndk);

        console.log("Review target address:", reviewTargetAddress)
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

    function goToPay() {
        if (secondaryEntityClone && reviewTargetAddress) {
            isOpen = false;
            const url = new URL('/payments/' + secondaryEntityClone.encode(), window.location.origin);
            goto(url.toString());
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
        if (!targetEntityClone) {
            handleMissingEntity();
            return;
        }
        try {
            isClosing = true;
            await tick();
            updateTargetEntityStatus();
            await publishReplacementEvent();
            await publishReviewIfNeeded();
            isOpen = false;
            goToPay();
        } catch (err) {
            handleCloseEntityError(err);
        }
    }
</script>

<ModalWrapper bind:isOpen title={`Close ${isJob ? 'Job' : 'Order'}?`}>
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
                            {`Close ${isJob ? 'Job' : 'Order'}` +
                                (reviewTargetAddress ? ' and Pay' : '')}
                        </span>
                    {/if}
                </Button>
            </div>
        </div>
        <!-- popups Entity-Close end -->
    </div>
</ModalWrapper>
