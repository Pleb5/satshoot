<script lang="ts">
    import {
        ReviewType,
        type ClientRating,
        type FreelancerRating,
        type ReviewEvent,
    } from '$lib/events/ReviewEvent';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import ndk from '$lib/stores/ndk';
    import { NDKSubscriptionCacheUsage, type NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { onMount } from 'svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { beforeNavigate } from '$app/navigation';
    import { getModalStore } from '@skeletonlabs/skeleton';

    export let review: ReviewEvent;

    const modalStore = getModalStore();

    let user = $ndk.getUser({ pubkey: review.pubkey });
    let userName = user.npub.substring(0, 8);
    let userImage = getRoboHashPicture(user.pubkey);

    let userProfile: NDKUserProfile | null;
    let job: TicketEvent | null;

    let elemPage: HTMLElement;
    onMount(async () => {
        elemPage = document.querySelector('#page') as HTMLElement;

        userProfile = await user.fetchProfile();
        if (userProfile) {
            if (userProfile.name) {
                userName = userProfile.name;
            }
            if (userProfile.image) {
                userImage = userProfile.image;
            }
        }

        if (review.reviewedEventAddress) {
            const reviewedEvent = await $ndk.fetchEvent(review.reviewedEventAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            if (reviewedEvent) {
                if (review.type === ReviewType.Client) {
                    job = TicketEvent.from(reviewedEvent);
                } else {
                    const offer = OfferEvent.from(reviewedEvent);
                    const jobEvent = await $ndk.fetchEvent(offer.referencedTicketAddress, {
                        groupable: true,
                        groupableDelay: 1000,
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    });
                    if (jobEvent) {
                        job = TicketEvent.from(jobEvent);
                    }
                }
            }
        }
    });

    // Determine if the review is for a freelancer or client
    const isFreelancerReview = review.type === ReviewType.Freelancer;
    const ratings = isFreelancerReview ? review.freelancerRatings : review.clientRatings;

    // Type assertions for ratings
    const freelancerRatings = isFreelancerReview ? (ratings as FreelancerRating) : undefined;
    const clientRatings = !isFreelancerReview ? (ratings as ClientRating) : undefined;

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
        modalStore.close()
    })
</script>

<div
    class="w-full flex flex-col gap-[10px] border-[1px] border-black-100 dark:border-white-100 rounded-[6px] bg-white-100 p-[10px]"
>
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col grow-[1] items-start">
            <a href={'/' + user.npub}>
                <p>{userName}</p>
            </a>
            <div class="flex flex-row gap-[5px] flex-wrap">
                <p>wrote a review for job:</p>
                {#if job}
                    <a
                        href={'/' + job.encode() + '/'}
                        class="anchor transition ease duration-[0.3s] font-[600]"
                    >
                        {job.title}
                    </a>
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
                        <i class="bx bxs-check-circle" />
                        <p>Job Fulfilled</p>
                    </div>
                {:else}
                    <div class={`${reviewBadgeClasses} text-white bg-red-600`}>
                        <i class="bx bxs-x-circle" />
                        <p>Job Unfulfilled</p>
                    </div>
                {/if}
            {:else if clientRatings?.thumb !== undefined}
                <!-- Client-specific badges -->
                {#if clientRatings.thumb}
                    <div class={`${reviewBadgeClasses} text-gray-500 bg-green-600`}>
                        <i class="bx bxs-check-circle" />
                        <p>Satisfied</p>
                    </div>
                {:else}
                    <div class={`${reviewBadgeClasses} text-white bg-red-600`}>
                        <i class="bx bxs-x-circle" />
                        <p>Dissatisfied</p>
                    </div>
                {/if}
            {/if}

            <!-- Shared badges -->
            <div class={getBadgeClasses(ratings.availability)}>
                <i class="bx bxs-star" />
                <p>{isFreelancerReview ? 'Availability' : 'Attentive & Responsive'}</p>
            </div>
            <div class={getBadgeClasses(ratings.communication)}>
                <i class="bx bxs-star" />
                <p>{isFreelancerReview ? 'Communication' : 'Clear Communication'}</p>
            </div>

            {#if isFreelancerReview && freelancerRatings?.expertise !== undefined}
                <div class={getBadgeClasses(freelancerRatings.expertise)}>
                    <i class="bx bxs-star" />
                    <p>Expertise</p>
                </div>
            {/if}
        </div>
    {/if}

    {#if review.created_at}
        <div
            class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 pl-[5px] pr-[5px] pt-[10px]"
        >
            <p class="font-[500] grow-[1] flex flex-row flex-wrap">
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
