<script lang="ts">
import {
    ReviewType,
    type ClientRating,
    type TroubleshooterRating 
} from "$lib/events/ReviewEvent";
import drawerID from '$lib/stores/drawer';
import { DrawerIDs } from '$lib/stores/drawer';
import { 
    getDrawerStore,
    type DrawerSettings,
} from "@skeletonlabs/skeleton";
import { onMount } from "svelte";

export let ratings: Map<string, number>;
const average = ratings.get('average') as number;

export let userRatings: Array<ClientRating> | Array<TroubleshooterRating>;

const drawerStore = getDrawerStore();

const reviewType = $drawerStore.meta['reviewType'];
const reviewTypeText = (
    reviewType === ReviewType.Client 
    ? 'Client' : 'Troubleshooter'
);
const userHex = $drawerStore.meta['user'];

let ratingConsensus = '';
let ratingColor = '';

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

onMount(() => {
    if (isNaN(average)) {
        ratingConsensus = 'No Ratings';
        ratingColor = 'bg-surface-500';
    } else {
        ratingConsensus = 'Excellent';
        ratingColor = 'bg-warning-500';
        if (average < 0.9) {
            ratingConsensus = 'Great';
            ratingColor = 'bg-tertiary-500';
        } 
        if (average < 0.75) {
            ratingConsensus = 'Good';
            ratingColor = 'bg-success-500';
        }
        if (average < 0.5) {
            ratingConsensus = 'Mixed ratings';
            ratingColor = 'bg-surface-500';
        }
        if (average < 0.25) {
            ratingConsensus = 'Bad';
            ratingColor = 'bg-error-500';
        }
    }
});

</script>

<div class="flex flex-col items-center gap-y-4">
    {#if ratings.size > 0}
        <h3 class="h3 underline">Rating Consensus</h3>
        <div class="badge text-lg sm:text-xl {ratingColor}">
            {ratingConsensus}
        </div>
    {:else}
        <h3 class="h3 underline">No Ratings found!</h3>
    {/if}
    <h3 class="h3 underline">Review Summary</h3>
    {#if ratings.size > 0}
        <div class="grid grid-cols-[1fr_auto] gap-x-4 text-lg">
            <div class="flex gap-x-2">
                <div>👍</div>
                <div>{Array.from(ratings.keys())[0]}:</div>
            </div>
            <div>{Array.from(ratings.values())[0] + 'X'}</div>
        </div>
        <h3 class="h3 mt-4 mb-2 underline">Exceptional Qualities Received:</h3>
        <div class="grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 mb-4 text-lg">
            {#each Array.from(ratings.keys()) as key, i}
                {#if i > 0 && key !== 'average'}
                    <div>⭐ {key}:</div>
                    <div>{ratings.get(key) + 'X'}</div>
                {/if}
            {/each}
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
