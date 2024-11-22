<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import { type FreelancerRating, ReviewEvent } from '$lib/events/ReviewEvent';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings, ModalSettings } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { RadioGroup, RadioItem } from '@skeletonlabs/skeleton';
    import { type SvelteComponent, tick } from 'svelte';
    import type { OfferEvent } from '$lib/events/OfferEvent';

    import { paymentDetail } from '$lib/stores/payment';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    /** Exposes parent props to this component. */
    export let parent: SvelteComponent;
    export let ticket: TicketEvent;
    export let offer: OfferEvent | null = null;

    let expertise = false;
    let availability = false;
    let communication = false;

    let reviewText = '';

    let closing = false;

    let closingStatus: TicketStatus.Resolved | TicketStatus.Failed = TicketStatus.Resolved;

    let errorMessage = '';

    async function closeTicket() {
        if (ticket) {
            const ticketToPublish = new TicketEvent($ndk);
            ticketToPublish.tags = ticket.tags;
            ticketToPublish.description = ticket.description;
            // Important part! This also sets status to in progress
            ticketToPublish.status = closingStatus;

            try {
                closing = true;
                console.log('connected relays before closing ticket:', $ndk.pool.connectedRelays());
                await tick();

                const relays = await ticketToPublish.publish();

                console.log('published relays', relays);

                // Post review data if applicable
                if (ticket.acceptedOfferAddress) {
                    const reviewEvent = new ReviewEvent($ndk);
                    reviewEvent.reviewedEventAddress = ticket.acceptedOfferAddress;

                    const rating: FreelancerRating = {
                        success: false,
                        expertise: false,
                        availability: false,
                        communication: false,
                        reviewText: reviewText,
                    };

                    if (closingStatus === TicketStatus.Resolved) {
                        rating.success = true;
                    }

                    rating.expertise = expertise;
                    rating.availability = availability;
                    rating.communication = communication;

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
                        ticket,
                        offer,
                    };

                    const currentPath = $page.url.pathname;
                    const paymentUrl = new URL('payment', window.location.origin);
                    paymentUrl.searchParams.set('redirectPath', currentPath);

                    goto(paymentUrl);
                }
            } catch (e) {
                console.log(e);
                closing = false;
                errorMessage = 'Error while closing: ' + e;
            }
        } else {
            closing = false;
            const t: ToastSettings = {
                message: 'Error: Could could not find ticket to close!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
            modalStore.close();
        }
    }
</script>

{#if $modalStore[0]}
    {#if ticket}
        <div class="card p-4">
            <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Close Ticket</h4>
            <div class="flex flex-col justify-center min-w-60 gap-y-4">
                <div class="text-md sm:text-xl text-center font-bold">Was Your Issue Resolved?</div>
                <RadioGroup active="variant-filled-primary" hover="hover:variant-soft-primary">
                    <RadioItem
                        bind:group={closingStatus}
                        required
                        name="status"
                        value={TicketStatus.Resolved}
                    >
                        Yes
                    </RadioItem>
                    <RadioItem bind:group={closingStatus} name="status" value={TicketStatus.Failed}>
                        No
                    </RadioItem>
                </RadioGroup>
                {#if offer}
                    <div class="text-md sm:text-xl text-center font-bold">
                        Select excellent qualities of the Freelancer, if any:
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
                        <span class="text-md sm:text-xl">Share your experience to help others:</span
                        >
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
                        on:click={() => modalStore.close()}
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
                            <span class="font-bold"
                                >{'Close Ticket' + (offer ? ' and Pay' : '')}</span
                            >
                        {/if}
                    </button>
                </div>
                {#if errorMessage}
                    <div class="text-error-500 text-center">{errorMessage}</div>
                {/if}
            </div>
        </div>
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600-token">Error: Ticket is missing!</h2>
    {/if}
{/if}
