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
} from '$lib/stores/reviews'

import ReviewSummary from "./ReviewSummary.svelte";
import { getDrawerStore } from "@skeletonlabs/skeleton";
import { onMount } from "svelte";

const drawerStore = getDrawerStore();

let reviewType = $drawerStore.meta['reviewType'];
$: if (reviewType) {
    $drawerStore.meta['reviewType'] = reviewType;
}

const userHex = $drawerStore.meta['user'];

let clientRatingsMap: Map<string, number>;
let freelancerRatingsMap: Map<string, number>;
let userClientRatingsArr: Array<ClientRating>;
let userFreelancerRatingsArr: Array<FreelancerRating>;

$: if ($clientReviews) {
    clientRatingsMap = aggregateClientRatings(userHex);
    userClientRatingsArr = userClientRatings($currentUser!.pubkey, userHex);
}

$: if ($freelancerReviews) {
    freelancerRatingsMap = aggregateFreelancerRatings(userHex);
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
        Client Reviews
    </Tab>
    <Tab bind:group={reviewType} name="tab2" value={ReviewType.Freelancer}>
        Freelancer Reviews
    </Tab>
    <!-- Tab Panels --->
    <svelte:fragment slot="panel">
        <div class="{baseClasses}">
            {#if clientRatingsMap && reviewType === ReviewType.Client}
                <ReviewSummary 
                    ratings={clientRatingsMap}
                    userRatings={userClientRatingsArr}
                />
            {:else if freelancerRatingsMap && reviewType === ReviewType.Freelancer}
                <ReviewSummary 
                    ratings={freelancerRatingsMap}
                    userRatings={userFreelancerRatingsArr}
                />
            {/if}
        </div>
    </svelte:fragment>
</TabGroup>




