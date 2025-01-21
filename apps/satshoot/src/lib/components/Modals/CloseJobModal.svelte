<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewEvent, type FreelancerRating } from '$lib/events/ReviewEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { paymentDetail } from '$lib/stores/payment';
    import {
        getModalStore,
        getToastStore,
        ProgressRadial,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import { tick } from 'svelte';
    import ReviewToggleQuestion from '../UI/Buttons/ReviewToggleQuestion.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalHeader from '../UI/Modal/ModalHeader.svelte';

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
                message: 'Error: Could could not find job to close!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
            modalStore.close();
        }
    }

    const textAreaClasses =
        'transition ease duration-[0.3s] w-full min-h-[100px] bg-[rgb(0,0,0,0.05)] ' +
        'border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px] px-[10px] py-[5px] outline-[0px] ' +
        'outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]';
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
                        <ModalHeader title="Close Job?" />
                        <div class="w-full flex flex-col">
                            <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                                <ReviewToggleQuestion
                                    question="Was Your Issue Resolved?"
                                    bind:value={isIssueResolved}
                                    trueLabel="Yes"
                                    falseLabel="No"
                                />

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
                                <div class="w-full flex flex-col gap-[5px]">
                                    <div class="w-full max-h-[50vh] overflow-auto">
                                        <p class="w-full">Share your experience to help others:</p>
                                    </div>
                                    <textarea
                                        placeholder="Describe your experience..."
                                        class={textAreaClasses}
                                        bind:value={reviewText}
                                    ></textarea>
                                </div>

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
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
