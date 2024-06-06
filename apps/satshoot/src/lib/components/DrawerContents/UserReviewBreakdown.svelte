<script lang="ts">
import UserReviewCard from "$lib/components/User/UserReviewCard.svelte";
import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";
import { type DrawerSettings, getDrawerStore } from "@skeletonlabs/skeleton";
import { DrawerIDs } from '$lib/stores/drawer';
import drawerID from '$lib/stores/drawer';

const drawerStore = getDrawerStore();

const userReviews = $drawerStore.meta['userReviews'] as Array<ClientRating | TroubleshooterRating> | undefined;
const reviews = $drawerStore.meta['ratings'] as Map<string, number> | undefined;

const baseClasses = 'card p-4 m-8 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw] overflow-y-auto';


function backToReviewBreadown() {
    $drawerID = DrawerIDs.ReviewBreakdown;
    const drawerSettings: DrawerSettings = {
        id: $drawerID,
        meta: { ratings: reviews, userReviews: userReviews },
        position: 'top',
        bgDrawer: 'bg-surface-300-600-token',
    };
    drawerStore.open(drawerSettings);
}
</script>

<div class="{baseClasses}">
    <div class="grid grid-cols-[10%_1fr_10%] items-center mb-4">
        <button
            type="button" 
            class="btn btn-icon-xl p-2 justify-self-start text-primary-400-500-token"
            on:click={backToReviewBreadown}>
            <span>
                <i 
                    class="fa-solid fa-arrow-left-long"
                >
                </i>
            </span>
        </button>
        <h2 class="h2 justify-self-center">User Reviews</h2>
    </div>
    {#if userReviews && userReviews.length > 0}
        <div class="flex flex-col items-center gap-y-4 text-2xl">
            {#each userReviews as userReview}
                <UserReviewCard review={userReview}/>
            {/each}
        </div>
    {:else}
        <h3 class="h3">No reviews to show</h3>
    {/if}
</div>
