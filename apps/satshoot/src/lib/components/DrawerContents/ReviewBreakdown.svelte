<script lang="ts">
import currentUser from "$lib/stores/user";
import {
    ReviewType,
    type ClientRating,
    type TroubleshooterRating,
} from "$lib/events/ReviewEvent";
 
import { 
    Tab,
    TabGroup,
} from "@skeletonlabs/skeleton";

import {
    clientReviews,
    troubleshooterReviews,
    aggregateClientRatings,
    aggregateTroubleshooterRatings,
    userClientRatings,
    userTroubleshooterRatings,
} from '$lib/stores/reviews'

import ReviewSummary from "./ReviewSummary.svelte";
import { getDrawerStore } from "@skeletonlabs/skeleton";

const drawerStore = getDrawerStore();

let reviewType = $drawerStore.meta['reviewType'];
$: if (reviewType) {
    $drawerStore.meta['reviewType'] = reviewType;
}

const userHex = $drawerStore.meta['user'];

let clientRatingsMap: Map<string, number>;
let troubleshooterRatingsMap: Map<string, number>;
let userClientRatingsArr: Array<ClientRating>;
let userTroubleshooterRatingsArr: Array<TroubleshooterRating>;

$: if ($clientReviews) {
    clientRatingsMap = aggregateClientRatings(userHex);
    clientRatingsMap.delete('average');
    userClientRatingsArr = userClientRatings($currentUser!.pubkey, userHex);
}

$: if ($troubleshooterReviews) {
    troubleshooterRatingsMap = aggregateTroubleshooterRatings(userHex);
    troubleshooterRatingsMap.delete('average');
    userTroubleshooterRatingsArr = userTroubleshooterRatings(
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
    <Tab bind:group={reviewType} name="tab2" value={ReviewType.Troubleshooter}>
        Troubleshooter Reviews
    </Tab>
    <!-- Tab Panels --->
    <svelte:fragment slot="panel">
        <div class="{baseClasses}">
            {#if clientRatingsMap && reviewType === ReviewType.Client}
                <ReviewSummary 
                    ratings={clientRatingsMap}
                    userRatings={userClientRatingsArr}
                />
            {:else if troubleshooterRatingsMap && reviewType === ReviewType.Troubleshooter}
                <ReviewSummary 
                    ratings={troubleshooterRatingsMap}
                    userRatings={userTroubleshooterRatingsArr}
                />
            {/if}
        </div>
    </svelte:fragment>
</TabGroup>




