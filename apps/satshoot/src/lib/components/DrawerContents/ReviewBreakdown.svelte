<script lang="ts">
import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";
import drawerID from '$lib/stores/drawer';
import { DrawerIDs } from '$lib/stores/drawer';
import { type DrawerSettings, getDrawerStore } from "@skeletonlabs/skeleton";

const drawerStore = getDrawerStore();

const reviews = $drawerStore.meta['ratings'] as Map<string, number> | undefined;
const userReviews = $drawerStore.meta['userReviews'] as Array<ClientRating | TroubleshooterRating> | undefined;

const baseClasses = 'card p-4 m-8 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw] overflow-y-auto';

function showUserReviewBreakdown() {
    $drawerID = DrawerIDs.UserReviewBreakdown;
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
    <div class="flex flex-col items-center gap-y-4 text-2xl">
        {#if reviews && reviews.size > 0}
            <div class="grid grid-cols-[1fr_auto] gap-x-4">
                <div>{Array.from(reviews.keys())[0]}:</div>
                <div>{Array.from(reviews.values())[0] + 'X'}</div>
            </div>
            <h3 class="h3 mt-4 mb-2 underline">Exceptional Qualities Received:</h3>
            <div class="grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 mb-4">
                {#each Array.from(reviews.keys()) as key, i}
                    {#if i > 0}
                        <div>{key}:</div>
                        <div>{reviews.get(key) + 'X'}</div>
                    {/if}
                {/each}
            </div>
        {/if}
        {#if userReviews && userReviews.length > 0}
            <div class="flex gap-x-4 items-center">
                <h3 class="h3">Your Reviews: {userReviews.length}</h3>
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
            <h3 class="h3">You have not reviewed this person yet.</h3>
        {/if}
    </div>
</div>
