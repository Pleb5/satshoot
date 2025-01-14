<script lang="ts">
    import { type ClientRating, ReviewEvent } from '$lib/events/ReviewEvent';
    import ndk from '$lib/stores/ndk';

    import type { ModalSettings, ToastSettings } from '@skeletonlabs/skeleton';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import { tick } from 'svelte';
    import CloseModal from '../UI/Buttons/CloseModal.svelte';
    import ReviewToggleQuestion from '../UI/Buttons/ReviewToggleQuestion.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    export let jobAddress: string;

    let thumb = true;
    let availability = false;
    let communication = false;

    let reviewText = '';

    let posting = false;

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

                modalStore.close();

                // Ticket posted Modal
                const modal: ModalSettings = {
                    type: 'alert',
                    title: 'Review Posted!',
                    body: `
                        <p class='mb-4'>Thank You for posting a Review!</p>
                        <p>
                        Freelancing just got better for everyone!
                        </p>
                        `,
                    buttonTextCancel: 'Ok',
                };
                modalStore.trigger(modal);
            } catch (e) {
                console.log(e);
                const t: ToastSettings = {
                    message: 'Error posting Review!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
                modalStore.close();
            }
        } else {
            posting = false;
            const t: ToastSettings = {
                message: 'Error: Could could not find ticket to close!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
        }
    }

    const textAreaClasses =
        'transition ease duration-[0.3s] w-full min-h-[100px] bg-[rgb(0,0,0,0.05)] ' +
        'border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px] px-[10px] py-[5px] outline-[0px] ' +
        'outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]';

    const publishBtnClasses =
        'transition-all ease duration-[0.3s] py-[5px] px-[10px] rounded-[4px] grow-[1] ' +
        'text-[rgb(225,225,225,0.75)] border-[1px] border-[rgb(0,0,0,0.1)] bg-[#3b73f6] ' +
        'hover:border-[rgb(0,0,0,0.0)] hover:text-white hover:bg-blue-500';
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
                    <div
                        class="w-full bg-white p-[15px] rounded-[8px] shadow-[0_0_8px_0_rgb(0,0,0,0.25)] gap-[5px]"
                    >
                        <div
                            class="flex flex-row justify-between gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
                        >
                            <p class="font-[500] text-[18px]">Review Client</p>
                            <CloseModal />
                        </div>
                        <div class="w-full flex flex-col">
                            <!-- popups Job-Close start -->
                            <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                                <ReviewToggleQuestion
                                    question="Were you satisfied with the work?"
                                    bind:value={thumb}
                                    trueLabel="Yes"
                                    falseLabel="No"
                                />
                                <div class="w-full flex flex-col gap-[5px]">
                                    <div class="w-full max-h-[50vh] overflow-auto">
                                        <p class="w-full">
                                            Select excellent qualities of the Client, if any:
                                        </p>
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
                                <div class="w-full flex flex-col gap-[5px]">
                                    <div class="w-full max-h-[50vh] overflow-auto">
                                        <p class="w-full">Share your experience to help others:</p>
                                    </div>
                                    <textarea
                                        placeholder="Describe your experience..."
                                        class={textAreaClasses}
                                        bind:value={reviewText}
                                    />
                                </div>
                                <div class="w-full flex flex-row gap-[10px]">
                                    <button class={publishBtnClasses} on:click={postClientReview}>
                                        {#if posting}
                                            <span>
                                                <ProgressRadial
                                                    value={undefined}
                                                    stroke={60}
                                                    meter="stroke-tertiary-500"
                                                    track="stroke-tertiary-500/30"
                                                    strokeLinecap="round"
                                                    width="w-8"
                                                />
                                            </span>
                                        {:else}
                                            Publish review
                                        {/if}
                                    </button>
                                </div>
                            </div>
                            <!-- popups Job-Close end -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
