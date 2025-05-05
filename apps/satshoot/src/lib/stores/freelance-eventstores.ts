import ndk from '$lib/stores/session';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter } from '@nostr-dev-kit/ndk';
import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
import { NDKKind } from '@nostr-dev-kit/ndk';

import { JobEvent } from '$lib/events/JobEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

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

export const allOffersFilter: NDKFilter = {
    kinds: [NDKKind.FreelanceOffer],
};

// The filter's pubkey part will be filled in when user logs in
export const myJobFilter: NDKFilter = {
    kinds: [NDKKind.FreelanceJob],
};

// The filter's pubkey part will be filled in when user logs in
export const myOfferFilter: NDKFilter = {
    kinds: [NDKKind.FreelanceOffer],
};
export const allJobs: NDKEventStore<ExtendedBaseType<JobEvent>> = get(ndk).storeSubscribe<JobEvent>(
    allJobsFilter,
    subOptions,
    JobEvent
);

export const allOffers: NDKEventStore<ExtendedBaseType<OfferEvent>> = get(
    ndk
).storeSubscribe<OfferEvent>(allOffersFilter, subOptions, OfferEvent);

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

export const wotFilteredOffers = derived([allOffers, wot], ([$allOffers, $wot]) => {
    const offers = $allOffers.filter((offer: OfferEvent) => {
        if (
            // Filter messages if they are in the web of trust
            $wot.has(offer.pubkey)
        ) {
            return true;
        }

        return false;
    });

    return offers;
});

export const myJobs: NDKEventStore<ExtendedBaseType<JobEvent>> = get(ndk).storeSubscribe<JobEvent>(
    myJobFilter,
    subOptions,
    JobEvent
);

export const myOffers: NDKEventStore<ExtendedBaseType<OfferEvent>> = get(
    ndk
).storeSubscribe<OfferEvent>(myOfferFilter, subOptions, OfferEvent);
