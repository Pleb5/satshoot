<script lang="ts">
import {
    ReviewType,
} from "$lib/events/ReviewEvent";
 
import { 
    Tab,
    TabGroup,

} from "@skeletonlabs/skeleton";

import {
    clientRatings,
    troubleshooterRatings,
    userClientReviews,
    userTroubleshooterReviews,
    reviewType
} from '$lib/stores/reviews'

import ReviewSummary from "./ReviewSummary.svelte";

console.log('clientRatings', $clientRatings)
console.log('troubleshooterRatings', $troubleshooterRatings)
console.log('userClientReviews', $userClientReviews)
console.log('userTroubleshooterReviews', $userTroubleshooterReviews)
console.log('reviewType', $reviewType)

const baseClasses = 'card p-4 m-8 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw] overflow-y-auto';

</script>

<TabGroup justify='justify-evenly' flex='flex-grow'>
    <Tab bind:group={$reviewType} name="tab1" value={ReviewType.Client}>
        Client Reviews
    </Tab>
    <Tab bind:group={$reviewType} name="tab2" value={ReviewType.Troubleshooter}>
        Troubleshooter Reviews
    </Tab>
    <!-- Tab Panels --->
    <svelte:fragment slot="panel">
        <div class="{baseClasses}">
            {#if reviewType === ReviewType.Client}
                <ReviewSummary 
                    ratings={$clientRatings}
                    userReviews={$userClientReviews}
                />
            {:else if reviewType === ReviewType.Troubleshooter}
                <ReviewSummary 
                    ratings={$troubleshooterRatings}
                    userReviews={$userTroubleshooterReviews}
                />
            {/if}
        </div>
    </svelte:fragment>
</TabGroup>




