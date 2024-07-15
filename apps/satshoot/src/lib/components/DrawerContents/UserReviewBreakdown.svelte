<script lang="ts">
import UserReviewCard from "$lib/components/User/UserReviewCard.svelte";
import { ReviewType, type ClientRating, type TroubleshooterRating } from "$lib/events/ReviewEvent";
import { type DrawerSettings, getDrawerStore } from "@skeletonlabs/skeleton";
import { DrawerIDs } from '$lib/stores/drawer';
import drawerID from '$lib/stores/drawer';
import currentUser from "$lib/stores/user";
import type { NDKUser } from "@nostr-dev-kit/ndk";

import {
    reviewType,
    userClientReviews,
    userTroubleshooterReviews,
} from '$lib/stores/reviews';

const drawerStore = getDrawerStore();

const userReviews = (
    reviewType === ReviewType.Client
    ? $userClientReviews
    : $userTroubleshooterReviews
);

const baseClasses = 'card p-2 m-8 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw] overflow-y-auto';

const reviewer = $currentUser as NDKUser;

function backToReviewBreadown() {
    $drawerID = DrawerIDs.ReviewBreakdown;
    const drawerSettings: DrawerSettings = {
        id: $drawerID.toString(),
        position: 'top',
        bgDrawer: 'bg-surface-300-600-token',
    };
    drawerStore.open(drawerSettings);
}
</script>

<div class="{baseClasses}">
    <button
        type="button" 
        class="btn btn-icon text-primary-400-500-token"
        on:click={backToReviewBreadown}>
        <span class="text-xl">
            <i 
                class="fa-solid fa-arrow-left-long"
            >
            </i>
        </span>
    </button>
    <h2 class="h2 text-center mb-2">User Reviews</h2>
    {#if userReviews && userReviews.length > 0}
        <div class="flex flex-col items-center gap-y-4 text-2xl">
            {#each userReviews as userReview}
                <UserReviewCard review={userReview} {reviewer}/>
            {/each}
        </div>
    {:else}
        <h3 class="h3">No reviews to show</h3>
    {/if}
</div>
