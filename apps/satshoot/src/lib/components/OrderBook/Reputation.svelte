<script lang="ts">
import ndk from "$lib/stores/ndk";
import { wot } from '$lib/stores/wot';
import { troubleshootZap } from '$lib/utils/helpers';
import { 
    clientReviews,
    troubleshooterReviews,
    aggregateClientRatings,
    aggregateTroubleshooterRatings
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

import drawerID, { DrawerIDs } from '$lib/stores/drawer';
import { type DrawerSettings, getDrawerStore } from "@skeletonlabs/skeleton";
import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';
import { ProgressRadial } from '@skeletonlabs/skeleton';
import { wotUpdating } from "$lib/stores/wot";
import type { NDKEventStore } from "@nostr-dev-kit/ndk-svelte";
import { SatShootPubkey } from "$lib/utils/misc";
import { onDestroy } from "svelte";

export let user: Hexpubkey;
export let type: ReviewType | undefined;
let reviewType: ReviewType;
export let open = true;

const drawerStore = getDrawerStore();

$: reviewArraysExist = $clientReviews && $troubleshooterReviews;
$: reviewsExist = reviewArraysExist && 
            ($clientReviews.length > 0 || $troubleshooterReviews.length > 0);

$: if (!type && reviewArraysExist) {
    if ($clientReviews.length > $troubleshooterReviews.length) {
        reviewType = ReviewType.Client;
    } else {
        reviewType = ReviewType.Troubleshooter;
    }
} else if (type) {
    reviewType = type;
}

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
        meta: {reviewType: reviewType, user: user},
        position: 'top',
        height: 'h-[70vh]',
        bgDrawer: 'bg-surface-300-600-token',
    };

    drawerStore.open(drawerSettings);
}

// $: if ($clientReviews) {
//     console.log('currentUser', $currentUser)
//     console.log('user', user)
//     console.log('clientReviews', $clientReviews)
//     console.log('troubleshooterReviews', $troubleshooterReviews)
// }
// $: console.log($troubleshooterReviews)

$: if (
    $currentUser
    && user
    && $clientReviews
    && $troubleshooterReviews
) {

    let otherTypeOfRatings;
    if (reviewType === ReviewType.Client) {
        ratings = aggregateClientRatings(user);
        otherTypeOfRatings = aggregateTroubleshooterRatings(user);
    } else {
        ratings = aggregateTroubleshooterRatings(user);
        otherTypeOfRatings = aggregateClientRatings(user);
    }

    const average = ratings!.get('average') as number;
    const otherTypeOfaverage = otherTypeOfRatings.get('average') as number;
    let overallAverage: number;

    // We take the average of both types of ratings if type is undefined
    if (type === undefined) {
        if (!isNaN(average) && !(isNaN(otherTypeOfaverage))) {
            overallAverage = (average + otherTypeOfaverage) / 2;
        } else if (isNaN(average) && !isNaN(otherTypeOfaverage)) {
            overallAverage = otherTypeOfaverage;
        } else if (isNaN(otherTypeOfaverage) && !isNaN(average)) {
            overallAverage = average;
        } else {
            overallAverage = NaN;
        }
    } else {
        overallAverage = average;
    }
    if (isNaN(overallAverage)) {
        ratingConsensus = 'No Ratings';
        ratingColor = 'bg-surface-500';
    } else {
        ratingConsensus = 'Excellent';
        ratingColor = 'bg-warning-500';
        if (overallAverage < 0.9) {
            ratingConsensus = 'Great';
            ratingColor = 'bg-tertiary-500';
        } 
        if (overallAverage < 0.75) {
            ratingConsensus = 'Good';
            ratingColor = 'bg-success-500';
        }
        if (overallAverage < 0.5) {
            ratingConsensus = 'Mixed ratings';
            ratingColor = 'bg-surface-500';
        }
        if (overallAverage < 0.25) {
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

<Accordion class="{baseClasses}">
    <AccordionItem bind:open={open}>
        <svelte:fragment slot="lead">
            <i class="fa-solid text-2xl text-warning-500 fa-handshake-simple"></i>
        </svelte:fragment>
        <svelte:fragment slot="summary">
            <div class="flex items-center justify-center">
                <h3 class="h4 sm:h3 text-center">User Reputation</h3>
            </div>
        </svelte:fragment>
        <svelte:fragment slot="content">
            {#if user
                && reviewArraysExist
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
        </svelte:fragment>
    </AccordionItem>
</Accordion>
