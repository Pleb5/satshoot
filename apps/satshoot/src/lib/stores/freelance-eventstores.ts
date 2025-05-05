import ndk from '$lib/stores/session';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter } from '@nostr-dev-kit/ndk';
import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
import { NDKKind } from '@nostr-dev-kit/ndk';

import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';

import { wot } from '$lib/stores/wot';

import { get, derived } from 'svelte/store';

// Export necessary when restarting a subscription with a new filter
export const subOptions: NDKSubscribeOptions = {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
};

export const allJobsFilter: NDKFilter = {
    kinds: [NDKKind.FreelanceJob],
};

export const allBidsFilter: NDKFilter = {
    kinds: [NDKKind.FreelanceBid],
};

// The filter's pubkey part will be filled in when user logs in
export const myJobFilter: NDKFilter = {
    kinds: [NDKKind.FreelanceJob],
};

// The filter's pubkey part will be filled in when user logs in
export const myBidFilter: NDKFilter = {
    kinds: [NDKKind.FreelanceBid],
};
export const allJobs: NDKEventStore<ExtendedBaseType<JobEvent>> = get(ndk).storeSubscribe<JobEvent>(
    allJobsFilter,
    subOptions,
    JobEvent
);

export const allBids: NDKEventStore<ExtendedBaseType<BidEvent>> = get(ndk).storeSubscribe<BidEvent>(
    allBidsFilter,
    subOptions,
    BidEvent
);

export const wotFilteredJobs = derived([allJobs, wot], ([$allJobs, $wot]) => {
    const jobs = $allJobs.filter((job: JobEvent) => {
        if (
            // Filter messages if they are in the web of trust
            $wot.has(job.pubkey)
        ) {
            return true;
        }

        return false;
    });

    return jobs;
});

export const wotFilteredBids = derived([allBids, wot], ([$allBids, $wot]) => {
    const bids = $allBids.filter((bid: BidEvent) => {
        if (
            // Filter messages if they are in the web of trust
            $wot.has(bid.pubkey)
        ) {
            return true;
        }

        return false;
    });

    return bids;
});

export const myJobs: NDKEventStore<ExtendedBaseType<JobEvent>> = get(ndk).storeSubscribe<JobEvent>(
    myJobFilter,
    subOptions,
    JobEvent
);

export const myBids: NDKEventStore<ExtendedBaseType<BidEvent>> = get(ndk).storeSubscribe<BidEvent>(
    myBidFilter,
    subOptions,
    BidEvent
);
