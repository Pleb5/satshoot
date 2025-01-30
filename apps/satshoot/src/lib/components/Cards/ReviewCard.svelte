<script lang="ts">
    import {
        ReviewType,
        type ClientRating,
        type FreelancerRating,
        type ReviewEvent,
    } from '$lib/events/ReviewEvent';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';

    export let review: ReviewEvent;

    let freelancerRatings: FreelancerRating | undefined = undefined;
    let clientRatings: ClientRating | undefined = undefined;

    $: if (review.type === ReviewType.Freelancer) {
        freelancerRatings = review.freelancerRatings;
    } else {
        clientRatings = review.clientRatings;
    }

    const reviewBadgeClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] font-[600] rounded-[4px] border-[1px] ' +
        'border-black-100 py-[5px] px-[10px] justify-center items-center';
</script>

<div
    class="w-full flex flex-col gap-[10px] border-[1px] border-black-100 rounded-[6px] bg-white-100 p-[10px]"
>
    <UserProfile pubkey={review.pubkey} />
    {#if review.reviewText}
        <div class="w-full border-[1px] border-black-100 rounded-[4px] bg-black-50">
            <ExpandableText text={review.reviewText} />
        </div>
    {/if}
    {#if freelancerRatings}
        <div class="w-full flex flex-row flex-wrap gap-[10px]">
            {#if freelancerRatings.success}
                <div class="{reviewBadgeClasses} text-gray-500 bg-green-600">
                    <i class="bx bxs-check-circle" />
                    <p class="">Job Fulfilled</p>
                </div>
            {:else}
                <div class="{reviewBadgeClasses} text-white bg-red-600">
                    <i class="bx bxs-x-circle" />
                    <p class="">Job Unfulfilled</p>
                </div>
            {/if}
            <div
                class={reviewBadgeClasses}
                class:text-white={freelancerRatings.availability}
                class:bg-blue-500={freelancerRatings.availability}
                class:text-black-500={!freelancerRatings.availability}
                class:bg-black-100={!freelancerRatings.availability}
            >
                <i class="bx bxs-star" />
                <p class="">Availability</p>
            </div>
            <div
                class={reviewBadgeClasses}
                class:text-white={freelancerRatings.communication}
                class:bg-blue-500={freelancerRatings.communication}
                class:text-black-500={!freelancerRatings.communication}
                class:bg-black-100={!freelancerRatings.communication}
            >
                <i class="bx bxs-star" />
                <p class="">Communication</p>
            </div>
            <div
                class="{reviewBadgeClasses} "
                class:text-white={freelancerRatings.expertise}
                class:bg-blue-500={freelancerRatings.expertise}
                class:text-black-500={!freelancerRatings.expertise}
                class:bg-black-100={!freelancerRatings.expertise}
            >
                <i class="bx bxs-star" />
                <p class="">Expertise</p>
            </div>
        </div>
    {:else if clientRatings}
        <div class="w-full flex flex-row flex-wrap gap-[10px]">
            {#if clientRatings.thumb}
                <div class="{reviewBadgeClasses} text-gray-500 bg-green-600">
                    <i class="bx bxs-check-circle"></i>
                    <p class="">Satisfied</p>
                </div>
            {:else}
                <div class="{reviewBadgeClasses} text-white bg-red-600">
                    <i class="bx bxs-x-circle"></i>
                    <p class="">Dissatisfied</p>
                </div>
            {/if}
            <div
                class="{reviewBadgeClasses} "
                class:text-white={clientRatings.availability}
                class:bg-blue-500={clientRatings.availability}
                class:text-black-500={!clientRatings.availability}
                class:bg-black-100={!clientRatings.availability}
            >
                <i class="bx bxs-star"></i>
                <p class="">Attentive & responsive</p>
            </div>
            <div
                class="{reviewBadgeClasses} "
                class:text-white={clientRatings.communication}
                class:bg-blue-500={clientRatings.communication}
                class:text-black-500={!clientRatings.communication}
                class:bg-black-100={!clientRatings.communication}
            >
                <i class="bx bxs-star"></i>
                <p class="">Clear communication</p>
            </div>
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
