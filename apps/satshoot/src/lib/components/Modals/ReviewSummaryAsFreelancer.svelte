<script lang="ts">
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import {
        aggregateFreelancerRatings,
        freelancerReviews,
        type AggregatedFreelancerRatings,
    } from '$lib/stores/reviews';
    import type { Hexpubkey } from '@nostr-dev-kit/ndk';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import ReviewCard from '../Cards/ReviewCard.svelte';
    import currentUser from '$lib/stores/user';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Card from '../UI/Card.svelte';
    import ModalHeader from '../UI/Modal/ModalHeader.svelte';

    const modalStore = getModalStore();

    export let userHex: Hexpubkey;

    let onlyShowMyReviews = false;

    let aggregatedFreelancerRatings: AggregatedFreelancerRatings;
    let numberOfPositiveOutcome = 0;
    let numberOfNegativeOutcome = 0;
    let rateOfPositiveOutcome = NaN;

    let reviews: ReviewEvent[] = [];
    let myReviews: ReviewEvent[] = [];

    $: if ($freelancerReviews) {
        aggregatedFreelancerRatings = aggregateFreelancerRatings(userHex);
        reviews = $freelancerReviews.filter((review) => review.reviewedPerson === userHex);
    }

    $: if ($currentUser && reviews) {
        myReviews = reviews.filter((review) => review.pubkey === $currentUser.pubkey);
    } else {
        myReviews = [];
    }

    $: if (aggregatedFreelancerRatings) {
        numberOfPositiveOutcome = aggregatedFreelancerRatings.success;
        numberOfNegativeOutcome = aggregatedFreelancerRatings.failure;
    }

    $: if (numberOfPositiveOutcome || numberOfNegativeOutcome) {
        rateOfPositiveOutcome = Math.round(
            (numberOfPositiveOutcome / (numberOfPositiveOutcome + numberOfNegativeOutcome)) * 100
        );
    }

    const jobFulfilledStatusClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] grow-[1] pl-[10px] font-[600] rounded-[4px] ' +
        'border-[1px] border-[rgb(0,0,0,0.1)] overflow-hidden justify-center items-center group';

    const qualitiesBadgeClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] grow-[1] pl-[10px] font-[600] rounded-[4px] border-[1px] ' +
        'border-[rgb(0,0,0,0.0)] overflow-hidden justify-center items-center text-white bg-[rgb(59,115,246)] group';
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[900px] justify-start items-center">
                    <Card>
                        <ModalHeader title="What clients say" />
                        <div class="w-full flex flex-col">
                            <!-- popups reviews-as-a-freelancer start -->
                            <div class="w-full py-[10px] px-[5px] flex flex-col gap-[15px]">
                                <div
                                    class="w-full flex flex-col gap-[10px] pb-[15px] border-b-[1px] border-[rgb(0,0,0,0.1)]"
                                >
                                    <div
                                        class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] gap-[10px] rounded-[6px] px-[10px] py-[15px] border-[1px] border-[rgb(0,0,0,0.1)]"
                                    >
                                        <p
                                            class="w-full pb-[5px] mb-[5px] border-b-[1px] border-[rgb(0,0,0,0.1)] text-center font-[600]"
                                        >
                                            Review Summary
                                        </p>
                                        <div class="w-full flex flex-row flex-wrap gap-[10px]">
                                            <div
                                                class="{jobFulfilledStatusClasses} text-[#636363] bg-[#5fff5f]"
                                            >
                                                <i class="bx bxs-check-circle" />
                                                <p class="grow-[1]">Fulfilled Jobs</p>
                                                <p class="bg-[rgb(0,0,0,0.1)] py-[5px] px-[10px]">
                                                    {numberOfPositiveOutcome}
                                                </p>
                                            </div>
                                            <div
                                                class="{jobFulfilledStatusClasses} text-white bg-[#ff5f5f]"
                                            >
                                                <i class="bx bxs-x-circle" />
                                                <p class="grow-[1]">Unfulfilled Jobs</p>
                                                <p class="bg-[rgb(0,0,0,0.1)] py-[5px] px-[10px]">
                                                    {numberOfNegativeOutcome}
                                                </p>
                                            </div>
                                        </div>
                                        {#if !isNaN(rateOfPositiveOutcome)}
                                            <div
                                                class="w-full flex flex-row justify-center items-center mb-[5px]"
                                            >
                                                <p
                                                    class="py-[5px] px-[15px] bg-[rgb(0,0,0,0.1)] rounded-[6px] border-[1px] border-[rgb(0,0,0,0.1)] grow-[1] text-center"
                                                >
                                                    Success rate: {rateOfPositiveOutcome}%
                                                </p>
                                            </div>
                                        {/if}
                                    </div>
                                    <div
                                        class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] gap-[10px] rounded-[6px] px-[10px] py-[15px] border-[1px] border-[rgb(0,0,0,0.1)]"
                                    >
                                        <p
                                            class="w-full pb-[5px] mb-[5px] border-b-[1px] border-[rgb(0,0,0,0.1)] text-center font-[600]"
                                        >
                                            Exceptional Qualities Received
                                        </p>
                                        <div class="w-full flex flex-row flex-wrap gap-[10px]">
                                            <div class={qualitiesBadgeClasses}>
                                                <i class="bx bxs-star" />
                                                <p class="grow-[1]">Availability</p>
                                                <p class="bg-[rgb(0,0,0,0.1)] py-[5px] px-[10px]">
                                                    {aggregatedFreelancerRatings.availability}
                                                </p>
                                            </div>
                                            <div class={qualitiesBadgeClasses}>
                                                <i class="bx bxs-star" />
                                                <p class="grow-[1]">Communication</p>
                                                <p class="bg-[rgb(0,0,0,0.1)] py-[5px] px-[10px]">
                                                    {aggregatedFreelancerRatings.communication}
                                                </p>
                                            </div>
                                            <div class={qualitiesBadgeClasses}>
                                                <i class="bx bxs-star" />
                                                <p class="grow-[1]">Expertise</p>
                                                <p class="bg-[rgb(0,0,0,0.1)] py-[5px] px-[10px]">
                                                    {aggregatedFreelancerRatings.expertise}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <Checkbox
                                    id="my-reviews-checkbox"
                                    label="Only show my reviews"
                                    bind:checked={onlyShowMyReviews}
                                />
                                <div class="w-full flex flex-col gap-[15px]">
                                    {#if onlyShowMyReviews}
                                        {#each myReviews as review}
                                            <ReviewCard {review} />
                                        {/each}
                                    {:else}
                                        {#each reviews as review}
                                            <ReviewCard {review} />
                                        {/each}
                                    {/if}
                                </div>
                            </div>

                            <!-- popups reviews-as-a-freelancer end -->
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
