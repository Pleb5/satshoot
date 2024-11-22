<script lang="ts">
import {
    ReviewType,
    type ClientRating,
    type FreelancerRating ,
    THUMBS_UP_TEXT,
    THUMBS_DOWN_TEXT,
    AVAILABILITY_TEXT,
    COMMUNICATION_TEXT,
    SUCCESS_TEXT,
    FAILED_TEXT,
    EXPERTISE_TEXT
} from "$lib/events/ReviewEvent";
import drawerID from '$lib/stores/drawer';
import { DrawerIDs } from '$lib/stores/drawer';
import { 
    getDrawerStore,
    type DrawerSettings,
} from "@skeletonlabs/skeleton";
import { type RatingConsensus, averageToRatingText } from '$lib/utils/helpers';
import type {
    AggregatedClientRatings,
    AggregatedFreelancerRatings 
} from "$lib/stores/reviews";

export let aggregateRatings: AggregatedClientRatings | AggregatedFreelancerRatings;
let positiveText: string = '';
let negativeText: string = '';
let rateOfPositiveOutcomeText = '';
let numberOfPositiveOutcome: number = 0;
let numberOfNegativeOutcome: number = 0;
let numberOfExpertiseLabels = 0;

if (aggregateRatings.type === 'client') {
    positiveText = THUMBS_UP_TEXT;
    negativeText = THUMBS_DOWN_TEXT;
    rateOfPositiveOutcomeText = 'Rate of Postive Experience:'
    numberOfPositiveOutcome = aggregateRatings.thumbsUp;
    numberOfNegativeOutcome = aggregateRatings.thumbsDown;
} else {
    positiveText = SUCCESS_TEXT;
    negativeText = FAILED_TEXT;
    rateOfPositiveOutcomeText = 'Success Rate:'
    numberOfPositiveOutcome = aggregateRatings.success;
    numberOfNegativeOutcome = aggregateRatings.failure;
    numberOfExpertiseLabels = aggregateRatings.expertise;
}

const rateOfPositiveOutcome = Math.round(
    numberOfPositiveOutcome / 
    (numberOfPositiveOutcome + numberOfNegativeOutcome) 
    * 100
);

const average = aggregateRatings.average;
const ratingText: RatingConsensus = averageToRatingText(average);
const ratingConsensus = ratingText.ratingConsensus; 
const ratingColor = ratingText.ratingColor; 


export let userRatings: Array<ClientRating> | Array<FreelancerRating>;

const drawerStore = getDrawerStore();

const reviewType = $drawerStore.meta['reviewType'];
const reviewTypeText = (
    reviewType === ReviewType.Client 
    ? 'Client' : 'Freelancer'
);
const userHex = $drawerStore.meta['user'];

function showUserReviewBreakdown() {
    $drawerID = DrawerIDs.UserReviewBreakdown;
    const drawerSettings: DrawerSettings = {
        id: $drawerID.toString(),
        meta: {reviewType: reviewType, user: userHex},
        position: 'top',
        height: 'h-[70vh]',
        bgDrawer: 'bg-surface-300-600-token',
    };
    drawerStore.open(drawerSettings);
}

</script>

<div class="flex flex-col items-center gap-y-4">
    {#if !isNaN(aggregateRatings.average)}
        <h3 class="h3 underline">Rating Consensus</h3>
        <div class="badge text-lg sm:text-xl {ratingColor}">
            {ratingConsensus}
        </div>
    {:else}
        <h3 class="h3 underline">No Ratings found!</h3>
    {/if}
    <h3 class="h3 underline">Review Summary</h3>
    {#if !isNaN(aggregateRatings.average)}
        <div class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-lg">
            <div>
                👍
                {positiveText}:
            </div>
            <div>
                {numberOfPositiveOutcome + 'X'}
            </div>
            <div>
                ❌
                {negativeText}:
            </div>
            <div>
                {numberOfNegativeOutcome + 'X'}
            </div>
        </div>
        <div class="flex gap-x-2">
            <div>{rateOfPositiveOutcomeText}</div>
            <div>{rateOfPositiveOutcome} %</div>
        </div>
        <h3 class="h3 mt-4 mb-2 underline">Exceptional Qualities Received:</h3>
        <div class="grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 mb-4 text-lg">
            <div>⭐ {AVAILABILITY_TEXT}:</div>
            <div>{aggregateRatings.availability + 'X'}</div>
            <div>⭐ {COMMUNICATION_TEXT}:</div>
            <div>{aggregateRatings.communication + 'X'}</div>
            {#if aggregateRatings.type === "freelancer"}
                <div>⭐ {EXPERTISE_TEXT}:</div>
                <div>{aggregateRatings.expertise + 'X'}</div>
            {/if}
        </div>
    {/if}
    {#if userRatings && userRatings.length > 0}
        <div class="flex gap-x-4 items-center">
            <h3 class="h4 sm:h3">Your Reviews: {userRatings.length}</h3>
            <button
                type="button" 
                class="btn btn-icon-xl p-2 text-start text-primary-400-500-token"
                on:click={showUserReviewBreakdown}>
                <span>
                    <i 
                        class="fa-solid fa-arrow-up-right-from-square "
                    >
                    </i>
                </span>
            </button>
        </div>
    {:else}
        <h4 class="h4 text-center">
            You have not reviewed this person as a {reviewTypeText} yet.
        </h4>
    {/if}
</div>
