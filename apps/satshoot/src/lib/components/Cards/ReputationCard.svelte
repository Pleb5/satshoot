<script lang="ts">
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { clientReviews, freelancerReviews } from '$lib/stores/reviews';
    import { averageToRatingText } from '$lib/utils/helpers';
    import { abbreviateNumber } from '$lib/utils/misc';
    import type { Hexpubkey } from '@nostr-dev-kit/ndk';
    import { onDestroy } from 'svelte';
    import ReviewSummaryAsFreelancer from '../Modals/ReviewSummaryAsFreelancer.svelte';
    import ReviewSummaryAsClient from '../Modals/ReviewSummaryAsClient.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import RatingBlock from '../UI/Display/RatingBlock.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import { ReputationService } from '$lib/services/reputation';
    import { sessionInitialized } from '$lib/stores/session';

    interface Props {
        user: Hexpubkey;
        type?: ReviewType;
        skipUserProfile?: boolean;
        forUserCard?: boolean;
        serviceAddress?: string;
    }

    let {
        user,
        type = undefined,
        skipUserProfile = false,
        forUserCard = false,
        serviceAddress,
    }: Props = $props();

    // Initialize reputation service
    const reputationService = $derived.by(() => new ReputationService(user));

    // Initialize when session is ready
    $effect(() => {
        if (!reputationService.isInitialized && $sessionInitialized) {
            reputationService.initialize();
        }
    });

    // Derived review data
    const clientAverage = $derived(reputationService.clientAverage);
    const freelancerAverage = $derived(reputationService.freelancerAverage);

    const reviewType = $derived(
        type ??
            ($clientReviews && $freelancerReviews
                ? $clientReviews.length > $freelancerReviews.length
                    ? ReviewType.Client
                    : ReviewType.Freelancer
                : undefined)
    );

    const overallAverage = $derived(
        reviewType === ReviewType.Client
            ? reputationService.clientAverage
            : reviewType === ReviewType.Freelancer
              ? reputationService.freelancerAverage
              : reputationService.overallAverage
    );

    const { ratingConsensus, ratingColor } = $derived(averageToRatingText(overallAverage));

    const { ratingConsensus: asClientRatingConsensus, ratingColor: asClientRatingColor } = $derived(
        averageToRatingText(clientAverage)
    );

    const { ratingConsensus: asFreelancerRatingConsensus, ratingColor: asFreelancerRatingColor } =
        $derived(averageToRatingText(freelancerAverage));

    // Financial data from service - now reactive
    let financialItems = $derived(reputationService.financialItems);

    let showReviewSummaryAsFreelancer = $state(false);
    let showReviewSummaryAsClient = $state(false);

    function showFreelancerReviewBreakdown() {
        showReviewSummaryAsFreelancer = true;
    }

    function showClientReviewBreakdown() {
        showReviewSummaryAsClient = true;
    }

    onDestroy(() => {
        reputationService.destroy();
    });

    const reputationBlockWrapperClasses =
        'transition ease duration-[0.3s] flex flex-col cursor-pointer w-full gap-[5px] hover:text-white p-[10px] rounded-[4px] hover:bg-blue-500 hover:shadow-soft group';
    const satsWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row flex-wrap gap-[10px] justify-between items-center rounded-[4px] px-[10px] py-[5px] hover:bg-blue-500 group';
    const boltIconWrapperClasses =
        'flex flex-row gap-[5px] items-center flex-wrap grow-[1] group-hover:border-r-[1px] group-hover:border-r-white-200 group-hover:text-white';
</script>

{#if !forUserCard}
    <div class="flex flex-row items-center gap-[10px]">
        <div>
            {#if reviewType === ReviewType.Freelancer}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    grow
                    onClick={showFreelancerReviewBreakdown}
                >
                    <p class="font-[500]">
                        Freelancer Reputation:
                        <span class="badge px-4 {ratingColor}">{asFreelancerRatingConsensus}</span>
                    </p>
                </Button>
            {:else if reviewType === ReviewType.Client}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    grow
                    onClick={showClientReviewBreakdown}
                >
                    <p class="font-[500]">
                        Client Reputation:
                        <span class="badge px-4 {ratingColor}">{asClientRatingConsensus}</span>
                    </p>
                </Button>
            {/if}
        </div>
    </div>
{/if}

{#if forUserCard}
    <Card classes="gap-[15px]">
        <div class="w-full flex flex-col gap-[15px]">
            <div class="w-full flex flex-col gap-[10px]">
                <div class="h4 sm:h3 text-center underline">Reputation</div>
                <div
                    class="w-full flex flex-col gap-[10px] border-[1px] border-black-100 dark:border-white-100 p-[10px] rounded-[4px] max-[768px]:flex-col"
                >
                    <button
                        class={reputationBlockWrapperClasses}
                        onclick={showFreelancerReviewBreakdown}
                    >
                        <RatingBlock
                            label="As a freelancer"
                            rating={asFreelancerRatingConsensus}
                            iconClass="bx bxs-star transition ease duration-[0.3s]"
                            hoverEffect={true}
                            color={asFreelancerRatingColor}
                        />
                    </button>
                    <button
                        class={reputationBlockWrapperClasses}
                        onclick={showClientReviewBreakdown}
                    >
                        <RatingBlock
                            label="As a client"
                            rating={asClientRatingConsensus}
                            iconClass="bx bxs-star transition ease duration-[0.3s]"
                            hoverEffect={true}
                            color={asClientRatingColor}
                        />
                    </button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[5px] rounded-[5px] p-[10px] border-[1px] border-black-200 dark:border-white-200"
            >
                {#each financialItems as { title, label, amount }}
                    <div {title} class={satsWrapperClasses}>
                        <p class={boltIconWrapperClasses}>
                            <i
                                class="bx bxs-bolt text-black-500 dark:text-white-500 group-hover:text-yellow-500"
                            ></i>
                            {label}
                        </p>
                        {#if !reputationService.isInitialized}
                            <div
                                class="placeholder bg-primary-300-600-token animate-pulse w-12"
                            ></div>
                        {:else}
                            <p class="group-hover:text-white">
                                {abbreviateNumber(amount) + ' sats'}
                            </p>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </Card>
{/if}

<ReviewSummaryAsFreelancer
    bind:isOpen={showReviewSummaryAsFreelancer}
    userHex={user}
    {serviceAddress}
/>
<ReviewSummaryAsClient bind:isOpen={showReviewSummaryAsClient} userHex={user} />
