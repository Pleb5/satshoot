<script lang="ts">
import UserReviewCard from "$lib/components/Cards/UserReviewCard.svelte";
import { type DrawerSettings, getDrawerStore } from "@skeletonlabs/skeleton";
import { DrawerIDs } from '$lib/stores/drawer';
import drawerID from '$lib/stores/drawer';
import currentUser from "$lib/stores/user";
import type { NDKUser } from "@nostr-dev-kit/ndk";

import {
    userClientRatings,
    userTroubleshooterRatings,
} from '$lib/stores/reviews';

import { ReviewType } from "$lib/events/ReviewEvent";

const drawerStore = getDrawerStore();

const reviewType = $drawerStore.meta['reviewType'];
const userHex = $drawerStore.meta['user'];

const reviewer = $currentUser as NDKUser;

const ratings = (reviewType === ReviewType.Client
    ? userClientRatings(reviewer.pubkey, userHex)
    : userTroubleshooterRatings(reviewer.pubkey, userHex)
);

const baseClasses = 'card p-2 m-8 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw] overflow-y-auto';


function backToReviewBreadown() {
    $drawerID = DrawerIDs.ReviewBreakdown;
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
    {#if ratings && ratings.length > 0}
        <div class="flex flex-col items-center gap-y-4 text-2xl">
            {#each ratings as userRating}
                <UserReviewCard rating={userRating} {reviewer}/>
            {/each}
        </div>
    {:else}
        <h3 class="h3">No reviews to show</h3>
    {/if}
</div>
