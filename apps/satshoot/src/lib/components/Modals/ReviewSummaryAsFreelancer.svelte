<script lang="ts">
    import { aggregateFreelancerRatings, freelancerReviews } from '$lib/stores/reviews';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type Hexpubkey,
        type NDKFilter,
    } from '@nostr-dev-kit/ndk';
    import ReviewCard from '../Cards/ReviewCard.svelte';
    import currentUser from '$lib/stores/user';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import ReputationService from '$lib/services/reputation';
    import { sessionInitialized } from '$lib/stores/session';
    import { abbreviateNumber } from '$lib/utils/misc';

    interface Props {
        isOpen: boolean;
        userHex: Hexpubkey;
        serviceAddress?: string;
    }

    let { isOpen = $bindable(), userHex, serviceAddress }: Props = $props();

    let onlyShowMyReviews = $state(false);
    let onlyShowReviewsOnCurrentService = $state(false);

    // Initialize reputation service
    const reputationService = $derived.by(() => new ReputationService(userHex));

    // Initialize when session is ready
    $effect(() => {
        if (!reputationService.isInitialized && $sessionInitialized) {
            reputationService.initialize();
        }
    });

    const aggregatedFreelancerRatings = $derived(aggregateFreelancerRatings(userHex));
    const { numberOfPositiveOutcome, numberOfNegativeOutcome } = $derived({
        numberOfPositiveOutcome: aggregatedFreelancerRatings.success,
        numberOfNegativeOutcome: aggregatedFreelancerRatings.failure,
    });
    const rateOfPositiveOutcome = $derived.by(() => {
        if (numberOfPositiveOutcome || numberOfNegativeOutcome) {
            return Math.round(
                (numberOfPositiveOutcome / (numberOfPositiveOutcome + numberOfNegativeOutcome)) *
                    100
            );
        }

        return NaN;
    });

    const reviews = $derived(
        $freelancerReviews.filter((review) => review.reviewedPerson === userHex)
    );
    const myReviews = $derived(
        reviews.filter((review) => $currentUser && review.pubkey === $currentUser.pubkey)
    );
    const reviewsOnCurrentService = $derived(
        reviews.filter((review) => review.reviewedEventAddress === serviceAddress)
    );

    const jobFulfilledStatusClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] grow-1 pl-[10px] font-[600] rounded-[4px] ' +
        'border-[1px] border-black-100 dark:border-white-100 overflow-hidden justify-center items-center group';

    const qualitiesBadgeClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] grow-1 pl-[10px] font-[600] rounded-[4px] border-[1px] ' +
        'border-transparent overflow-hidden justify-center items-center text-white bg-blue-500 group';
</script>

<ModalWrapper bind:isOpen title="What clients say">
    <div class="w-full flex flex-col">
        <!-- popups reviews-as-a-freelancer start -->
        <div class="w-full py-[10px] px-[5px] flex flex-col gap-[15px]">
            <div
                class="w-full flex flex-col gap-[10px] pb-[15px] border-b-[1px] border-black-100 dark:border-white-100"
            >
                <div
                    class="w-full flex flex-col bg-black-50 gap-[10px] rounded-[6px] px-[10px] py-[15px] border-[1px] border-black-100 dark:border-white-100"
                >
                    <p
                        class="w-full pb-[5px] mb-[5px] border-b-[1px] border-black-100 dark:border-white-100 text-center font-[600]"
                    >
                        Review Summary
                    </p>
                    <div class="w-full flex flex-row flex-wrap gap-[10px]">
                        <div class="{jobFulfilledStatusClasses} text-gray-500 bg-green-600">
                            <i class="bx bxs-check-circle"></i>
                            <p class="grow-1">Fulfilled Jobs</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {numberOfPositiveOutcome}
                            </p>
                        </div>
                        <div class="{jobFulfilledStatusClasses} text-white bg-red-600">
                            <i class="bx bxs-x-circle"></i>
                            <p class="grow-1">Unfulfilled Jobs</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {numberOfNegativeOutcome}
                            </p>
                        </div>
                    </div>
                    {#if !isNaN(rateOfPositiveOutcome)}
                        <div class="w-full flex flex-row justify-center items-center mb-[5px]">
                            <p
                                class="py-[5px] px-[15px] bg-black-100 rounded-[6px] border-[1px] border-black-100 dark:border-white-100 grow-1 text-center"
                            >
                                Success rate: {rateOfPositiveOutcome}%
                            </p>
                        </div>
                    {/if}
                </div>
                <div
                    class="w-full flex flex-col bg-black-50 gap-[10px] rounded-[6px] px-[10px] py-[15px] border-[1px] border-black-100 dark:border-white-100"
                >
                    <p
                        class="w-full pb-[5px] mb-[5px] border-b-[1px] border-black-100 dark:border-white-100 text-center font-[600]"
                    >
                        Exceptional Qualities Received
                    </p>
                    <div class="w-full flex flex-row flex-wrap gap-[10px]">
                        <div class={qualitiesBadgeClasses}>
                            <i class="bx bxs-star"></i>
                            <p class="grow-1">Communication</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {aggregatedFreelancerRatings.communication}
                            </p>
                        </div>
                        <div class={qualitiesBadgeClasses}>
                            <i class="bx bxs-star"></i>
                            <p class="grow-1">Expertise</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {aggregatedFreelancerRatings.expertise}
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="w-full flex flex-col bg-black-50 gap-[10px] rounded-[6px] px-[10px] py-[15px] border-[1px] border-black-100 dark:border-white-100"
                >
                    <p
                        class="w-full pb-[5px] mb-[5px] border-b-[1px] border-black-100 dark:border-white-100 text-center font-[600]"
                    >
                        Payments
                    </p>
                    <div class="w-full flex flex-row flex-wrap gap-[10px]">
                        <div class={qualitiesBadgeClasses}>
                            <i class="bx bxs-bolt text-yellow-500"></i>
                            <p class="grow-1">Earnings</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {abbreviateNumber(reputationService.earnings) + ' sats'}
                            </p>
                        </div>
                        <div class={qualitiesBadgeClasses}>
                            <i class="bx bxs-bolt text-yellow-500"></i>
                            <p class="grow-1">Pledges</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {abbreviateNumber(reputationService.pledges) + ' sats'}
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
            {#if serviceAddress}
                <Checkbox
                    id="service-reviews-checkbox"
                    label="Only show reviews on current service"
                    bind:checked={onlyShowReviewsOnCurrentService}
                />
            {/if}
            <div class="w-full flex flex-col gap-[15px]">
                {#if onlyShowMyReviews}
                    {#each myReviews as review}
                        <ReviewCard {review} bind:isOpen />
                    {/each}
                {:else if onlyShowReviewsOnCurrentService}
                    {#each reviewsOnCurrentService as review}
                        <ReviewCard {review} bind:isOpen />
                    {/each}
                {:else}
                    {#each reviews as review}
                        <ReviewCard {review} bind:isOpen />
                    {/each}
                {/if}
            </div>
        </div>

        <!-- popups reviews-as-a-freelancer end -->
    </div>
</ModalWrapper>
