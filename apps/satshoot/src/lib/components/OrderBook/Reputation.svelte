<script lang="ts">
import { 
    clientReviews,
    troubleshooterReviews,
    aggregateRatings,
    userReviews,
} from "$lib/stores/reviews";

import {
    ReviewType,
    type TroubleshooterRating,
    type ClientRating
} from "$lib/events/ReviewEvent";

import type { Hexpubkey } from "@nostr-dev-kit/ndk";
import currentUser from "$lib/stores/user";

import { type DrawerSettings, getDrawerStore } from "@skeletonlabs/skeleton";
import { ProgressRadial } from '@skeletonlabs/skeleton';
import drawerID, { DrawerIDs } from '$lib/stores/drawer';
import { wotUpdating } from "$lib/stores/wot";

export let user: Hexpubkey | undefined = undefined;
export let type: ReviewType;

const drawerStore = getDrawerStore();

const reviews = (type === ReviewType.Client 
    ? clientReviews : troubleshooterReviews
); 

$: if($clientReviews) {
    console.log('client review arrived', $clientReviews)
}
$: if($troubleshooterReviews) {
    console.log('troubleshooter review arrived', $troubleshooterReviews)
}

let ratings: Map<string, number> | undefined = undefined;
let userReviewsArr: Array<ClientRating | TroubleshooterRating> | undefined = undefined;

const baseClasses = 'card p-4 bg-surface-300-600-token';

let ratingConsensus = '?';
let ratingColor = '';

function showReviewBreakdown() {
    $drawerID = DrawerIDs.ReviewBreakdown;
    const drawerSettings: DrawerSettings = {
        id: $drawerID,
        meta: { ratings: ratings, userReviews: userReviewsArr },
        position: 'top',
        bgDrawer: 'bg-surface-300-600-token',
    };
    drawerStore.open(drawerSettings);
}

$: if ($currentUser && user && $reviews) {
    ratings = aggregateRatings(user, type);
    const average = ratings.get('average') as number;
    // we dont display the exact average in the breakdown
    ratings.delete('average');
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
    userReviewsArr = userReviews($currentUser.pubkey, user, type);
}

</script>

<div class="{baseClasses}">
    <h3 class="h3 sm:h4 text-center mb-4">Reputation</h3>
    {#if user && $reviews}
        <div class="flex flex-grow justify-between mb-2">
            <div class="flex gap-x-2">
                <div class="flex flex-col items-center gap-y-2">
                    <div class="flex items-center">
                        <h5 class="h4 sm:h5 underline">Ratings</h5>
                        {#if $reviews.length > 0}
                            <button
                                type="button" 
                                class="btn btn-icon-sm sm:btn-icon-lg p-2 text-start text-primary-400-500-token"
                                on:click={showReviewBreakdown}>
                                <span>
                                    <i 
                                        class="fa-solid fa-arrow-up-right-from-square "
                                    >
                                    </i>
                                </span>
                            </button>
                        {/if}
                    </div>
                    {#if $wotUpdating}
                        <ProgressRadial
                        value={undefined}
                        stroke={60}
                        meter="stroke-primary-500"
                        track="stroke-primary-500/30"
                        strokeLinecap="round" width="w-8" 
                    />
                    {:else}
                        <div class="badge px-4 py-2 {ratingColor}">
                            {ratingConsensus}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {:else}
        <div class="grid grid-cols-[1fr_1fr_1fr] gap-8 items-center">
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
        </div>
    {/if}
</div>
