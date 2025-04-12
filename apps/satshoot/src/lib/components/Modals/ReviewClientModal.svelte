<script lang="ts">
    import { type ClientRating, ReviewEvent } from '$lib/events/ReviewEvent';
    import ndk from '$lib/stores/ndk';

    import { createToaster } from '@skeletonlabs/skeleton-svelte';
    import { tick } from 'svelte';
    import ReviewToggleQuestion from '../UI/Buttons/ReviewToggleQuestion.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Popup from '../UI/Popup.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    const toaster = createToaster();

    interface Props {
        isOpen: boolean;
        jobAddress: string;
    }

    let { isOpen = $bindable(), jobAddress }: Props = $props();

    let thumb = $state(true);
    let availability = $state(false);
    let communication = $state(false);

    $effect(() => {
        if (!thumb) {
            availability = communication = false;
        }
    });

    let reviewText = $state('');

    let posting = $state(false);

    async function postClientReview() {
        if (jobAddress) {
            try {
                posting = true;
                await tick();

                // Post review data if applicable
                const reviewEvent = new ReviewEvent($ndk);
                reviewEvent.reviewedEventAddress = jobAddress;

                const rating: ClientRating = {
                    thumb: false,
                    availability: false,
                    communication: false,
                    reviewText: reviewText,
                };

                rating.thumb = thumb;
                rating.availability = availability;
                rating.communication = communication;

                reviewEvent.clientRatings = rating;

                console.log('review event:', reviewEvent);
                const relays = await reviewEvent.publish();
                console.log('published relays', relays);

                isOpen = false;
                toaster.success({
                    title: 'Thank You for posting a Review!',
                    description: 'Freelancing just got better for everyone!',
                });
            } catch (e) {
                console.log(e);

                toaster.error({
                    title: 'Error posting Review!',
                });
                isOpen = false;
            }
        } else {
            posting = false;
            toaster.error({
                title: 'Error: Could could not find ticket to close!',
            });
        }
    }
</script>

<ModalWrapper bind:isOpen title="Review Client">
    <div class="w-full flex flex-col">
        <!-- popups Job-Close start -->
        <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
            <ReviewToggleQuestion
                question="Were you satisfied with the work?"
                bind:value={thumb}
                trueLabel="Yes"
                falseLabel="No"
            />
            {#if thumb}
                <div class="w-full flex flex-col gap-[5px]">
                    <div class="w-full max-h-[50vh] overflow-auto">
                        <p class="w-full">Select excellent qualities of the Client, if any:</p>
                    </div>
                    <div class="w-full py-[10px] px-[5px] flex flex-col gap-[10px]">
                        <Checkbox
                            id="availability"
                            label="Highly available, attentive, and responsive"
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
            <div class="w-full flex flex-row gap-[10px]">
                <Button grow onClick={postClientReview}>
                    {#if posting}
                        <span>
                            <ProgressRing />
                        </span>
                    {:else}
                        Publish review
                    {/if}
                </Button>
            </div>
        </div>
        <!-- popups Job-Close end -->
    </div>
</ModalWrapper>
