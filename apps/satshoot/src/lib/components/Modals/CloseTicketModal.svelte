<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import { type TroubleshooterRating , ReviewEvent } from "$lib/events/ReviewEvent";

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
    export let ticket: TicketEvent;

    let expertise = false;
    let availability = false;
    let communication = false;

    let reviewText = '';

    let closing = false;

    let closingStatus: TicketStatus.Resolved | TicketStatus.Failed = TicketStatus.Resolved;

    async function closeTicket() {
        if (ticket) {
            let ticketToPublish = new TicketEvent($ndk);
            ticketToPublish.tags = ticket.tags;
            ticketToPublish.description = ticket.description;
            // Important part! This also sets status to in progress
            ticketToPublish.status = closingStatus;

            try {
                closing = true;
                await tick();

                await ticketToPublish.publish();

                // Post review data if applicable
                if (ticket.acceptedOfferAddress) {
                    const reviewEvent = new ReviewEvent($ndk);
                    reviewEvent.reviewedEventAddress = ticket.acceptedOfferAddress;

                    const rating: TroubleshooterRating = {
                        success: false,
                        expertise: false,
                        availability: false,
                        communication: false,
                        reviewText: reviewText,
                    }

                    if (closingStatus === TicketStatus.Resolved) {
                        rating.success = true;
                    }

                    rating.expertise = expertise;
                    rating.availability = availability;
                    rating.communication = communication;

                    reviewEvent.troubleshooterRatings = rating;

                    console.log('review event:', reviewEvent);
                    const relays = await reviewEvent.publish();
                    console.log('published relays', relays);
                }

                modalStore.close();

                // Ticket posted Modal
                const modal: ModalSettings = {
                    type: 'alert',
                    title: 'Ticket Closed!',
                    body: `
                        <p class='mb-4'>You Closed the Ticket!</p>
                        <p>
                        You will find this Ticket in 'My Tickets' under the 'Closed' tab!
                        </p>
                        `,
                    buttonTextCancel:'Ok',
                };
                modalStore.trigger(modal);
            } catch(e) {
                console.log(e)
                const t: ToastSettings = {
                    message: 'Error while closing Ticket!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
                modalStore.close();
            }
        } else {
            closing = false;
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
    {#if ticket}
        <div class="card p-4">
            <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Close Ticket</h4>
            <div class="flex flex-col justify-center min-w-60 gap-y-4">
                <div class="text-md sm:text-xl text-center font-bold">
                    Was Your Issue Resolved?
                </div>
                <RadioGroup 
                    active="variant-filled-primary"
                    hover="hover:variant-soft-primary"
                >
						<RadioItem 
                            bind:group={closingStatus}
                            required
                            name="status"
                            value={TicketStatus.Resolved}

                        >
                            Yes
                        </RadioItem>
						<RadioItem
                            bind:group={closingStatus}
                            name="status" 
                            value={TicketStatus.Failed}
                        >
                            No
                        </RadioItem>
                </RadioGroup>
                {#if ticket.acceptedOfferAddress}
                    <div class="text-md sm:text-xl text-center font-bold">
                        Select excellent qualities of the Troubleshooter, if any:
                    </div>
                    <div class="space-y-2">
                        <label class="flex items-center space-x-2 text-sm sm:text-lg">
                            <input class="checkbox" type="checkbox" bind:value={expertise} />
                            <p>A skilled expert</p>
                        </label>
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
                {/if}
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
                        on:click={closeTicket}
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                        disabled={closing}
                    >
                        {#if closing}
                            <span>
                                <ProgressRadial value={undefined} stroke={60} meter="stroke-error-500"
                                    track="stroke-error-500/30" strokeLinecap="round" width="w-8" />
                            </span>
                        {:else}
                            <span>Close Ticket</span>
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
