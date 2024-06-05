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
import drawerID from '$lib/stores/drawer';

export let user: Hexpubkey | undefined = undefined;
export let type: ReviewType;

const drawerStore = getDrawerStore();

const reviews = (type === ReviewType.Client ? clientReviews : troubleshooterReviews); 
let ratings: Map<string, number> | undefined = undefined;
let userReviewsArr: Array<ClientRating | TroubleshooterRating> | undefined = undefined;

const baseClasses = 'card p-4 m-8 mt-4 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw]';

let ratingConsensus = '';
let ratingColor = '';

function showReviewBreakdown() {
    
    const drawerSettings: DrawerSettings = {
        id: $drawerID,
        meta: { ratings: ratings, userReviews: userReviewsArr }
    };
    drawerStore.open(drawerSettings);
}

$: if (user && $reviews) {
    ratings = aggregateRatings(user, type);
    const average = ratings.get('average') as number;
    ratingConsensus = 'Excellent';
    ratingColor = 'text-warning-500';
    if (average < 0.9) {
        ratingConsensus = 'Great';
        ratingColor = 'text-tertiary-500';
    } 
    if (average < 0.75) {
        ratingConsensus = 'Good';
        ratingColor = 'text-success-500';
    }
    if (average < 0.5) {
        ratingConsensus = 'Mixed ratings';
        ratingColor = 'text-surface-500';
    }
    if (average < 0.25) {
        ratingConsensus = 'Bad';
        ratingColor = 'text-error-500';
    }
    userReviewsArr = userReviews($currentUser!.pubkey, user, type);
}

</script>

<div class="{baseClasses}">
    <h2 class="h2">Reputation</h2>
    {#if user}
        <div class="flex justify-between mb-2">
            <div class="flex flex-col items-center gap-y-2">
                <h3 class="h3">Ratings</h3>
                <div class="{ratingColor}">{ratingConsensus}</div>
            </div>
        </div>
    {:else}
        <section class="w-[200px] md:w-[400px] p-4">
            <div class="grid grid-cols-[1fr_1fr_1fr] gap-8 items-center">
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
            </div>
        </section>
    {/if}
</div>
