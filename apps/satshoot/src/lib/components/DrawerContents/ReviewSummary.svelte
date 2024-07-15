<script lang="ts">
import {
    type ClientRating,
    type TroubleshooterRating 
} from "$lib/events/ReviewEvent";
import drawerID from '$lib/stores/drawer';
import { DrawerIDs } from '$lib/stores/drawer';
import { 
    getDrawerStore,
    type DrawerSettings,
} from "@skeletonlabs/skeleton";

export let ratings: Map<string, number>;
export let userReviews: Array<ClientRating | TroubleshooterRating>;

console.log('ratings', ratings)
console.log('userReviews', userReviews)

const drawerStore = getDrawerStore();

function showUserReviewBreakdown() {
    $drawerID = DrawerIDs.UserReviewBreakdown;
    const drawerSettings: DrawerSettings = {
        id: $drawerID.toString(),
        position: 'top',
        bgDrawer: 'bg-surface-300-600-token',
    };
    drawerStore.open(drawerSettings);
}

</script>

<div class="flex flex-col items-center gap-y-4">
    <h3 class="h3 underline">Review Summary</h3>
    {#if ratings.size > 0}
        <div class="grid grid-cols-[1fr_auto] gap-x-4 text-lg">
            <div>{Array.from(ratings.keys())[0]}:</div>
            <div>{Array.from(ratings.values())[0] + 'X'}</div>
        </div>
        <h3 class="h3 mt-4 mb-2 underline">Exceptional Qualities Received:</h3>
        <div class="grid grid-cols-[1fr_auto] gap-y-2 gap-x-6 mb-4 text-lg">
            {#each Array.from(ratings.keys()) as key, i}
                {#if i > 0}
                    <div>{key}:</div>
                    <div>{ratings.get(key) + 'X'}</div>
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
