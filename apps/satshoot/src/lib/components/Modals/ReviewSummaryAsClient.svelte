<script lang="ts">
    import { aggregateClientRatings, clientReviews } from '$lib/stores/reviews';
    import type { Hexpubkey } from '@nostr-dev-kit/ndk';
    import ReviewCard from '../Cards/ReviewCard.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import currentUser from '$lib/stores/user';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        userHex: Hexpubkey;
    }

    let { isOpen = $bindable(), userHex }: Props = $props();

    let onlyShowMyReviews = $state(false);

    const aggregatedClientRatings = $derived(aggregateClientRatings(userHex));
    const { numberOfPositiveOutcome, numberOfNegativeOutcome } = $derived({
        numberOfPositiveOutcome: aggregatedClientRatings.thumbsUp,
        numberOfNegativeOutcome: aggregatedClientRatings.thumbsDown,
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

    const reviews = $derived($clientReviews.filter((review) => review.reviewedPerson === userHex));
    const myReviews = $derived(
        reviews.filter((review) => $currentUser && review.pubkey === $currentUser.pubkey)
    );

    const jobFulfilledStatusClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] grow-1 pl-[10px] font-[600] rounded-[4px] ' +
        'border-[1px] border-black-100 dark:border-white-100 overflow-hidden justify-center items-center group';

    const qualitiesBadgeClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] grow-1 pl-[10px] font-[600] rounded-[4px] border-[1px] ' +
        'border-transparent overflow-hidden justify-center items-center text-white bg-blue-500 group';
</script>

<ModalWrapper bind:isOpen title="What freelancers say">
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
                            <p class="grow-1">Satisfied</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {numberOfPositiveOutcome}
                            </p>
                        </div>
                        <div class="{jobFulfilledStatusClasses} text-white bg-red-600">
                            <i class="bx bxs-x-circle"></i>
                            <p class="grow-1">Dissatisfied</p>
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
                            <p class="grow-1">Attentive & responsive</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {aggregatedClientRatings.availability}
                            </p>
                        </div>
                        <div class={qualitiesBadgeClasses}>
                            <i class="bx bxs-star"></i>
                            <p class="grow-1">Clear Communication</p>
                            <p class="bg-black-100 py-[5px] px-[10px]">
                                {aggregatedClientRatings.communication}
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
                        <ReviewCard {review} bind:isOpen={isOpen} />
                    {/each}
                {:else}
                    {#each reviews as review}
                        <ReviewCard {review} bind:isOpen={isOpen} />
                    {/each}
                {/if}
            </div>
        </div>

        <!-- popups reviews-as-a-freelancer end -->
    </div>
</ModalWrapper>
