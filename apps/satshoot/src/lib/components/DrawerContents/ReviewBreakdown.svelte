<script lang="ts">
import currentUser from "$lib/stores/user";
import {
    ReviewType,
} from "$lib/events/ReviewEvent";
 
import { 
    Tab,
    TabGroup,
} from "@skeletonlabs/skeleton";

import {
    aggregateRatings,
    userReviews
} from '$lib/stores/reviews'

import ReviewSummary from "./ReviewSummary.svelte";
import { getDrawerStore } from "@skeletonlabs/skeleton";

const drawerStore = getDrawerStore();

let reviewType = $drawerStore.meta['reviewType'];
$: if (reviewType) {
    $drawerStore.meta['reviewType'] = reviewType;
}

const userHex = $drawerStore.meta['user'];

const clientRatings = aggregateRatings(
    userHex, ReviewType.Client
);
const troubleshooterRatings = aggregateRatings(
    userHex, ReviewType.Troubleshooter
);
clientRatings.delete('average');
troubleshooterRatings.delete('average');

const userClientReviews = userReviews(
    $currentUser!.pubkey, userHex, ReviewType.Client
);
const userTroubleshooterReviews = userReviews(
    $currentUser!.pubkey, userHex, ReviewType.Troubleshooter
);

const baseClasses = 'card p-4 m-8 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw] overflow-y-auto';

</script>

<TabGroup justify='justify-evenly' flex='flex-grow'>
    <Tab bind:group={reviewType} name="tab1" value={ReviewType.Client}>
        Client Reviews
    </Tab>
    <Tab bind:group={reviewType} name="tab2" value={ReviewType.Troubleshooter}>
        Troubleshooter Reviews
    </Tab>
    <!-- Tab Panels --->
    <svelte:fragment slot="panel">
        <div class="{baseClasses}">
            {#if reviewType === ReviewType.Client}
                <ReviewSummary 
                    ratings={clientRatings}
                    userReviews={userClientReviews}
                />
            {:else if reviewType === ReviewType.Troubleshooter}
                <ReviewSummary 
                    ratings={troubleshooterRatings}
                    userReviews={userTroubleshooterReviews}
                />
            {/if}
        </div>
    </svelte:fragment>
</TabGroup>




