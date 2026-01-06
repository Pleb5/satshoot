<script lang="ts">
    import {
        ReviewType,
        type ClientRating,
        type FreelancerRating,
        type ReviewEvent,
    } from '$lib/events/ReviewEvent';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import ndk from '$lib/stores/session';
    import { NDKSubscriptionCacheUsage, type NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { JobEvent } from '$lib/events/JobEvent';
    import { onMount } from 'svelte';
    import { BidEvent } from '$lib/events/BidEvent';
    import { beforeNavigate, goto } from '$app/navigation';
    import { page } from '$app/state';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';
    import Avatar from '$lib/components/Users/Avatar.svelte';
    interface Props {
        review: ReviewEvent;
        isOpen: boolean;
    }

    let { review, isOpen = $bindable() }: Props = $props();

    const user = $derived.by(() => $ndk.getUser({ pubkey: review.pubkey }));

    let userProfile = $state<NDKUserProfile | null>(null);
    const userName = $derived.by(() =>
        userProfile?.name ? userProfile.name : user.npub.substring(0, 8)
    );
    let reviewedEvent = $state<JobEvent | ServiceEvent | null>(null);
    let label = $state('');

    let elemPage: HTMLElement;
    onMount(async () => {
        elemPage = document.querySelector('#page') as HTMLElement;

        if (review.reviewedEventAddress) {
            const event = await $ndk.fetchEvent(review.reviewedEventAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            const reviewedEventKind = parseInt(review.reviewedEventAddress.split(':')[0]);

            if (event) {
                if (reviewedEventKind === ExtendedNDKKind.FreelanceService) {
                    reviewedEvent = ServiceEvent.from(event);
                    label = 'has reviewed service:';
                } else if (reviewedEventKind === ExtendedNDKKind.FreelanceJob) {
                    reviewedEvent = JobEvent.from(event);
                    label = 'has reviewed job:';
                } else if (reviewedEventKind === ExtendedNDKKind.FreelanceBid) {
                    const bid = BidEvent.from(event);
                    const jobEvent = await $ndk.fetchEvent(bid.referencedJobAddress, {
                        groupable: true,
                        groupableDelay: 1000,
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    });
                    if (jobEvent) {
                        reviewedEvent = JobEvent.from(jobEvent);
                        label = 'has reviewed a bid on job:';
                    }
                } else if (reviewedEventKind === ExtendedNDKKind.FreelanceOrder) {
                    const order = OrderEvent.from(event);
                    const serviceEvent = await $ndk.fetchEvent(order.referencedServiceAddress, {
                        groupable: true,
                        groupableDelay: 1000,
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    });
                    if (serviceEvent) {
                        reviewedEvent = ServiceEvent.from(serviceEvent);
                        label = 'has reviewed an order on service:';
                    }
                }
            }
        }
    });
    
    // Determine if the review is for a freelancer or client
    const isFreelancerReview = $derived(review.type === ReviewType.Freelancer);
    const ratings = $derived(isFreelancerReview ? review.freelancerRatings : review.clientRatings);

    // Type assertions for ratings
    const freelancerRatings = $derived(
        isFreelancerReview ? (ratings as FreelancerRating) : undefined
    );
    const clientRatings = $derived(!isFreelancerReview ? (ratings as ClientRating) : undefined);

    // Base classes for review badges
    const reviewBadgeClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] font-[600] rounded-[4px] border-[1px] ' +
        'border-black-100 dark:border-white-100 py-[5px] px-[10px] justify-center items-center';

    // Function to compute badge classes based on a condition
    function getBadgeClasses(condition: boolean) {
        return condition
            ? `${reviewBadgeClasses} text-white bg-blue-500`
            : `${reviewBadgeClasses} text-black-500 dark:text-white-500 bg-black-100`;
    }

    beforeNavigate(() => {
        if (elemPage) {
            elemPage.scrollTo({ top: elemPage.scrollHeight * -1, behavior: 'instant' });
        }
    });

    const gotoReviewedEvent = async () => {
        if (reviewedEvent) {
            const url = `/${reviewedEvent.encode()}/`;
            const currentPath = page.url.pathname;
            const targetPath = new URL(url, window.location.origin).pathname;

            // Check if we're on the same route (but with different params)
            if (currentPath !== targetPath) {
                // Same route with different params - force reload
                await goto(url, { replaceState: true });
                window.location.reload();
            }
            isOpen = false;
        }
    };
</script>

<div
    class="w-full flex flex-col gap-[10px] border-[1px] border-black-100 dark:border-white-100 rounded-[6px] bg-white-100 p-[10px]"
>
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <Avatar pubkey={user.pubkey} size={"medium"} bind:userProfile classes={"shadow-strong"} />
        </a>
        <div class="flex flex-col grow-1 items-start">
            <a href={'/' + user.npub}>
                <p>{userName}</p>
            </a>
            <div class="flex flex-row gap-[5px] flex-wrap">
                {#if reviewedEvent}
                    <p>
                        {label}
                    </p>
                    <button
                        onclick={gotoReviewedEvent}
                        class="anchor transition ease duration-[0.3s] font-[600] bg-none"
                    >
                        {reviewedEvent.title}
                    </button>
                {:else}
                    <div class="w-full h-4 placeholder animate-pulse bg-blue-600"></div>
                {/if}
            </div>
        </div>
    </div>

    {#if review.reviewText}
        <div
            class="w-full border-[1px] border-black-100 dark:border-white-100 rounded-[4px] bg-black-50"
        >
            <ExpandableText text={review.reviewText} />
        </div>
    {/if}

    {#if ratings}
        <div class="w-full flex flex-row flex-wrap gap-[10px]">
            {#if isFreelancerReview && freelancerRatings?.success !== undefined}
                <!-- Freelancer-specific badges -->
                {#if freelancerRatings.success}
                    <div class={`${reviewBadgeClasses} text-gray-500 bg-green-600`}>
                        <i class="bx bxs-check-circle"></i>
                        <p>Job Fulfilled</p>
                    </div>
                {:else}
                    <div class={`${reviewBadgeClasses} text-white bg-red-600`}>
                        <i class="bx bxs-x-circle"></i>
                        <p>Job Unfulfilled</p>
                    </div>
                {/if}
            {:else if clientRatings?.thumb !== undefined}
                <!-- Client-specific badges -->
                {#if clientRatings.thumb}
                    <div class={`${reviewBadgeClasses} text-gray-500 bg-green-600`}>
                        <i class="bx bxs-check-circle"></i>
                        <p>Satisfied</p>
                    </div>
                {:else}
                    <div class={`${reviewBadgeClasses} text-white bg-red-600`}>
                        <i class="bx bxs-x-circle"></i>
                        <p>Dissatisfied</p>
                    </div>
                {/if}
            {/if}

            {#if ratings.communication}
                <!-- Shared badges -->
                <div class={getBadgeClasses(ratings.communication)}>
                    <i class="bx bxs-star"></i>
                    <p>{isFreelancerReview ? 'Communication' : 'Clear Communication'}</p>
                </div>
            {/if}

            {#if isFreelancerReview && freelancerRatings?.expertise}
                <div class={getBadgeClasses(freelancerRatings.expertise)}>
                    <i class="bx bxs-star"></i>
                    <p>Expertise</p>
                </div>
            {/if}
        </div>
    {/if}

    {#if review.created_at}
        <div
            class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 pl-[5px] pr-[5px] pt-[10px]"
        >
            <p class="font-[500] grow-1 flex flex-row flex-wrap">
                Review published on:
                <span class="font-[300]">
                    {formatDate(review.created_at * 1000, 'dd-MMM-yyyy, h:m a') +
                        ', ' +
                        formatDistanceToNow(review.created_at * 1000) +
                        ' Ago'}
                </span>
            </p>
        </div>
    {/if}
</div>
