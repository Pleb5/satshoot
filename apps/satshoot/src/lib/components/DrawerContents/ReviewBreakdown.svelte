<script lang="ts">
import currentUser from "$lib/stores/user";
import {
    ReviewType,
    type ClientRating,
    type FreelancerRating,
} from "$lib/events/ReviewEvent";
 
import { 
    Tab,
    TabGroup,
} from "@skeletonlabs/skeleton";

import {
    clientReviews,
    freelancerReviews,
    aggregateClientRatings,
    aggregateFreelancerRatings,
    userClientRatings,
    userFreelancerRatings,
    type AggregatedClientRatings,
    type AggregatedFreelancerRatings,
} from '$lib/stores/reviews'

import ReviewSummary from "./ReviewSummary.svelte";
import { getDrawerStore } from "@skeletonlabs/skeleton";

const drawerStore = getDrawerStore();

let reviewType = $drawerStore.meta['reviewType'];
$: if (reviewType) {
    $drawerStore.meta['reviewType'] = reviewType;
}

const userHex = $drawerStore.meta['user'];

let aggregatedClientRatings: AggregatedClientRatings;
let aggregatedFreelancerRatings: AggregatedFreelancerRatings;
let userClientRatingsArr: Array<ClientRating>;
let userFreelancerRatingsArr: Array<FreelancerRating>;

$: if ($clientReviews) {
    aggregatedClientRatings = aggregateClientRatings(userHex);
    userClientRatingsArr = userClientRatings($currentUser!.pubkey, userHex);
}

$: if ($freelancerReviews) {
    aggregatedFreelancerRatings = aggregateFreelancerRatings(userHex);
    userFreelancerRatingsArr = userFreelancerRatings(
        $currentUser!.pubkey,
        userHex
    );
}

const baseClasses = 'card p-4 m-8 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw] overflow-y-auto';

</script>

<TabGroup justify='justify-evenly' flex='flex-grow'>
    <Tab bind:group={reviewType} name="tab1" value={ReviewType.Client}>
        As a Client
    </Tab>
    <Tab bind:group={reviewType} name="tab2" value={ReviewType.Freelancer}>
        As a Freelancer
    </Tab>
    <!-- Tab Panels --->
    <svelte:fragment slot="panel">
        <div class="{baseClasses}">
            {#if aggregatedClientRatings && reviewType === ReviewType.Client}
                <ReviewSummary 
                    aggregateRatings={aggregatedClientRatings}
                    userRatings={userClientRatingsArr}
                />
            {:else if aggregatedFreelancerRatings && reviewType === ReviewType.Freelancer}
                <ReviewSummary 
                    aggregateRatings={aggregatedFreelancerRatings}
                    userRatings={userFreelancerRatingsArr}
                />
            {/if}
        </div>
    </svelte:fragment>
</TabGroup>




