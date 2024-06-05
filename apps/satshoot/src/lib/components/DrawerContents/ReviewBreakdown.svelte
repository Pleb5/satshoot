<script lang="ts">
import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";
import UserReviewCard from "../User/UserReviewCard.svelte";
import { getDrawerStore } from "@skeletonlabs/skeleton";

const drawerStore = getDrawerStore();

const reviews = $drawerStore.meta['ratings'] as Map<string, number> | undefined;
const userReviews = $drawerStore.meta['userReviews'] as Array<ClientRating | TroubleshooterRating> | undefined;

const baseClasses = 'p-4 m-8 mt-4 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw]';

</script>

<div class="{baseClasses}">
    <div class="flex flex-col gap-y-4">
        {#if reviews}
            {#each Array.from(reviews.keys()) as key}
                <div class="flex gap-x-4">
                    <div>{key}:</div>
                    <div>{reviews.get(key)}</div>
                </div>
            {/each}
        {/if}
        {#if userReviews && userReviews.length > 0}
            {#each userReviews as review}
                <UserReviewCard {review} />
            {/each}
        {:else}
            <div>No user reviews for this person yet.</div>
        {/if}
    </div>
</div>
