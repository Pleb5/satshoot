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
import { onMount } from "svelte";

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
    userClientRatingsArr = userClientRatings($currentUser!.pubkey, userHex);
}

$: if ($troubleshooterReviews) {
    troubleshooterRatingsMap = aggregateTroubleshooterRatings(userHex);
    userTroubleshooterRatingsArr = userTroubleshooterRatings(
        $currentUser!.pubkey,
        userHex
    );
}


onMount(() => {
    const elemPage:HTMLElement = document.querySelector('#page') as HTMLElement;
    // Scroll to top as soon as ticket arrives
    elemPage.scrollTo({ top: elemPage.scrollHeight*(-1), behavior:'instant' });
});

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




