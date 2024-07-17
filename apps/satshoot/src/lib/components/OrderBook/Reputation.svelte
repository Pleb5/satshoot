<script lang="ts">
import ndk from "$lib/stores/ndk";
import { wot } from '$lib/stores/wot';
import { troubleshootZap } from '$lib/utils/helpers';
import { 
    clientReviews,
    troubleshooterReviews,
    aggregateRatings,
} from "$lib/stores/reviews";

import {
    ReviewType,
} from "$lib/events/ReviewEvent";

import { insertThousandSeparator } from '$lib/utils/misc';
import { zapInvoiceFromEvent } from "@nostr-dev-kit/ndk";
import { 
    NDKEvent, 
    NDKKind, 
    type Hexpubkey, 
} from "@nostr-dev-kit/ndk";

import currentUser from "$lib/stores/user";

import { type DrawerSettings, getDrawerStore } from "@skeletonlabs/skeleton";
import { ProgressRadial } from '@skeletonlabs/skeleton';
import drawerID, { DrawerIDs } from '$lib/stores/drawer';
import { wotUpdating } from "$lib/stores/wot";
import type { NDKEventStore } from "@nostr-dev-kit/ndk-svelte";
import { SatShootPubkey } from "$lib/utils/misc";
import { onDestroy } from "svelte";

export let user: Hexpubkey;
export let type: ReviewType | undefined;

const drawerStore = getDrawerStore();

$: reviewsArraysExist = $clientReviews && $troubleshooterReviews;
$: reviewsExist = reviewsArraysExist && 
            ($clientReviews.length > 0 || $troubleshooterReviews.length > 0);

let ratings: Map<string, number> | undefined = undefined;

const subOptions = {
    closeOnEose: false,
    groupable: true,
    groupableDelay: 1500,
    autoStart: true
}

let allEarningsStore: NDKEventStore<NDKEvent>;
let allPaymentsStore: NDKEventStore<NDKEvent>;
let allPledgesStore: NDKEventStore<NDKEvent>;

let allEarnings = 0;
let allPayments = 0;
let allPledges = 0;

const baseClasses = 'card p-4 bg-surface-300-600-token';

let ratingConsensus = '?';
let ratingColor = '';

function showReviewBreakdown() {
    $drawerID = DrawerIDs.ReviewBreakdown;
    const drawerSettings: DrawerSettings = {
        id: $drawerID.toString(),
        meta: {reviewType: type, user: user},
        position: 'top',
        height: 'h-[70vh]',
        bgDrawer: 'bg-surface-300-600-token',
    };

    drawerStore.open(drawerSettings);
}

$: if (
    $currentUser
    && user
    && reviewsArraysExist
) {
    if (type === undefined) {
        // type is undefined we show the aggregate ratings of the review store
        // that has more reviews in it. Expecting to have substantially more in one of them
        if ($clientReviews.length > $troubleshooterReviews.length) {
            type = ReviewType.Client;
        } else {
            type = ReviewType.Troubleshooter;
        }
    } 

    ratings = aggregateRatings(user, type);
    const average = ratings.get('average') as number;
    // we dont display the exact average in the breakdown
    ratings.delete('average');
    if (isNaN(average)) {
        ratingConsensus = 'No Ratings';
        ratingColor = 'bg-surface-500';
    } else {
        ratingConsensus = 'Excellent';
        ratingColor = 'bg-warning-500';
        if (average < 0.9) {
            ratingConsensus = 'Great';
            ratingColor = 'bg-tertiary-500';
        } 
        if (average < 0.75) {
            ratingConsensus = 'Good';
            ratingColor = 'bg-success-500';
        }
        if (average < 0.5) {
            ratingConsensus = 'Mixed ratings';
            ratingColor = 'bg-surface-500';
        }
        if (average < 0.25) {
            ratingConsensus = 'Bad';
            ratingColor = 'bg-error-500';
        }
    }

}

$: if($currentUser && user && $wot) {
    allEarningsStore = $ndk.storeSubscribe(
        {kinds: [NDKKind.Zap], '#p': [user]},
        subOptions,
    );

    allPaymentsStore = $ndk.storeSubscribe(
        {kinds: [NDKKind.Zap], '#P': [user]},
        subOptions,
    );

    allPledgesStore = $ndk.storeSubscribe(
        {
            kinds: [NDKKind.Zap],
            '#P': [user],
            '#p': [SatShootPubkey]
        },
        subOptions,
    );
}

$: if ($allEarningsStore) {
    allEarnings = 0;
    $allEarningsStore.forEach((zap: NDKEvent)=>{
        const zappee = zap.tagValue('P');
        if (zappee && $wot.has(zappee) && troubleshootZap(zap)) {
            const zapInvoice = zapInvoiceFromEvent(zap);
            if (zapInvoice && zapInvoice.amount) {
                allEarnings += Math.round(zapInvoice.amount / 1000);
            }
        }
    });
}

$: if ($allPaymentsStore) {
    allPayments = 0;
    $allPaymentsStore.forEach((zap: NDKEvent)=>{
        const zappee = zap.tagValue('P')
        if (zappee && $wot.has(zappee) && troubleshootZap(zap)) {
            const zapInvoice = zapInvoiceFromEvent(zap);
            if (zapInvoice && zapInvoice.amount) {
                allPayments += Math.round(zapInvoice.amount / 1000);            }
        }
    });
}

$: if ($allPledgesStore) {
    allPledges = 0;
    $allPledgesStore.forEach((zap: NDKEvent)=>{
        const zappee = zap.tagValue('P')
        if (zappee && $wot.has(zappee)) {
            const zapInvoice = zapInvoiceFromEvent(zap);
            if (zapInvoice && zapInvoice.amount) {
                allPledges += Math.round(zapInvoice.amount / 1000);
            }
        }
    });
}

onDestroy(()=>{
    if (allEarningsStore) allEarningsStore.empty();
    if (allPaymentsStore) allPaymentsStore.empty();
    if (allPledgesStore) allPledgesStore.empty();
});

</script>

<div class="{baseClasses}">
    <h3 class="h3 sm:h4 text-center mb-4">User Reputation</h3>
    {#if user
        && reviewsArraysExist
        && $allEarningsStore
        && $allPaymentsStore
        && $allPledgesStore
    }
        <div class="flex flex-grow justify-center sm:justify-between flex-wrap gap-y-2 gap-x-4">
            <div class="flex gap-x-2">
                <div class="flex flex-col items-center gap-y-2">
                    <div class="flex items-center">
                        <h5 class="h5 sm:h4 underline">Ratings</h5>
                        {#if reviewsExist}
                            <button
                                type="button" 
                                class="btn btn-icon text-start text-primary-400-500-token"
                                on:click={showReviewBreakdown}>
                                <span>
                                    <i 
                                        class="fa-solid fa-arrow-up-right-from-square "
                                    >
                                    </i>
                                </span>
                            </button>
                        {/if}
                    </div>
                    {#if $wotUpdating}
                        <ProgressRadial
                        value={undefined}
                        stroke={60}
                        meter="stroke-primary-500"
                        track="stroke-primary-500/30"
                        strokeLinecap="round" width="w-8" 
                    />
                    {:else}
                        <div class="badge px-4 py-2 {ratingColor}">
                            {ratingConsensus}
                        </div>
                    {/if}
                </div>
            </div>
            <!-- Earnings -->
            <div class="flex items-center">
                <div class="flex flex-col items-center gap-y-2">
                    <h5 class="h5 sm:h4 underline">
                        <span class="text-warning-500">
                            <i class="fa-solid fa-bolt"></i>
                        </span>
                        <span>All Earnings</span>
                    </h5>
                    <div>
                        <span>
                            {
                                (allEarnings 
                                    ? insertThousandSeparator(allEarnings)
                                    : '?'
                                ) + ' sats'
                            }
                        </span>
                    </div>
                </div>
            </div>
            <!-- Payments -->
            <div class="flex items-center">
                <div class="flex flex-col items-center gap-y-2">
                    <h5 class="h5 sm:h4 underline">
                        <span class="text-warning-500">
                            <i class="fa-solid fa-bolt"></i>
                        </span>
                        <span>All Payments</span>
                    </h5>
                    <div>
                        <span>
                            {
                                (allPayments
                                    ? insertThousandSeparator(allPayments)
                                    : '?'
                                ) + ' sats'
                            }
                        </span>
                    </div>
                </div>
            </div>
            <div class="flex items-center">
                <div class="flex flex-col items-center gap-y-2">
                    <h5 class="h5 sm:h4 underline">
                        <span class="text-warning-500">
                            <i class="fa-solid fa-bolt"></i>
                        </span>
                        <span>All Pledges</span>
                    </h5>
                    <div>
                        <span>
                            {
                                (allPledges
                                    ? insertThousandSeparator(allPledges)
                                    : '?'
                                ) + ' sats'
                            }
                        </span>
                    </div>
                </div>
            </div>
        </div>
    {:else}
        <div class="grid grid-cols-[1fr_1fr_1fr] gap-8 items-center">
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
        </div>
    {/if}
</div>
