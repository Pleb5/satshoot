<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import { type ClientRating , ReviewEvent } from "$lib/events/ReviewEvent";

    import { getToastStore } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings, ModalSettings } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { RadioGroup, RadioItem } from '@skeletonlabs/skeleton';
    import { type SvelteComponent, tick } from "svelte";

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    /** Exposes parent props to this component. */
    export let parent: SvelteComponent;
    export let ticketAddress: string;

    let thumb = true;
    let availability = false;
    let communication = false;

    let reviewText = '';

    let posting = false;

    async function postClientReview() {
        if (ticketAddress) {
            try {
                posting = true;
                await tick();

                // Post review data if applicable
                const reviewEvent = new ReviewEvent($ndk);
                reviewEvent.reviewedEventAddress = ticketAddress;

                const rating: ClientRating = {
                    thumb: false,
                    availability: false,
                    communication: false,
                    reviewText: reviewText,
                }

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
                    buttonTextCancel:'Ok',
                };
                modalStore.trigger(modal);
            } catch(e) {
                console.log(e)
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

</script>

{#if $modalStore[0]}
    {#if ticketAddress}
        <div class="card p-4">
            <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Review Client</h4>
            <div class="flex flex-col justify-center min-w-60 gap-y-4">
                <div class="text-md sm:text-xl text-center font-bold">
                    Overall experience with this Client:
                </div>
                <RadioGroup 
                    active="variant-filled-primary"
                    hover="hover:variant-soft-primary"
                >
						<RadioItem 
                            class='text-xl'
                            bind:group={thumb}
                            name="thumb"
                            value={true}
                        >
                            👍
                        </RadioItem>
						<RadioItem
                            class='text-xl'
                            bind:group={thumb}
                            name="thumb" 
                            value={false}
                        >
                            👎
                        </RadioItem>
                </RadioGroup>
                <div class="text-md sm:text-xl text-center font-bold">
                    Select excellent qualities of the Client, if any:
                </div>
                <div class="space-y-2">
                    <label class="flex items-center space-x-2 text-sm sm:text-lg">
                        <input class="checkbox" type="checkbox" bind:value={availability} />
                        <p>Highly available, attentive and responsive</p>
                    </label>
                    <label class="flex items-center space-x-2 text-sm sm:text-lg">
                        <input class="checkbox" type="checkbox" bind:value={communication} />
                        <p>Especially clear and kind communication</p>
                    </label>
                </div>
                <label class="label max-w-xl">
                    <span class="text-md sm:text-xl">Share your experience to help others:</span>
                    <textarea 
                    class="textarea"
                    rows="3"
                    placeholder="Describe your experience..."
                    bind:value={reviewText}
                />
                </label>
                <div class="grid grid-cols-[30%_1fr] gap-x-2">
                    <button 
                        type="button"
                        class="btn btn-sm sm:btn-md bg-error-300-600-token"
                        on:click={()=> modalStore.close()}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        on:click={postClientReview}
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                        disabled={posting}
                    >
                        {#if posting}
                            <span>
                                <ProgressRadial value={undefined} stroke={60} meter="stroke-error-500"
                                    track="stroke-error-500/30" strokeLinecap="round" width="w-8" />
                            </span>
                        {:else}
                            <span>Post Review</span>
                        {/if}

                    </button>
                </div>
            </div>
        </div>
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600-token">
            Error: Ticket is missing!
        </h2>
    {/if}
{/if}
