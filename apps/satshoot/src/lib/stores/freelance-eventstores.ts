import ndk from '$lib/stores/session';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter } from '@nostr-dev-kit/ndk';
import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';

import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';

import { wot } from '$lib/stores/wot';

import { get, derived } from 'svelte/store';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { OrderEvent } from '$lib/events/OrderEvent';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

// Export necessary when restarting a subscription with a new filter
export const subOptions: NDKSubscribeOptions = {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
};

export const allJobsFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceJob],
};

export const allBidsFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceBid],
};

export const allServicesFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceService],
};

export const allOrdersFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceOrder],
};

// The filter's pubkey part will be filled in when user logs in
export const myJobFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceJob],
};

// The filter's pubkey part will be filled in when user logs in
export const myBidFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceBid],
};

// The filter's pubkey part will be filled in when user logs in
export const myServiceFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceService],
};

// The filter's pubkey part will be filled in when user logs in
export const myOrderFilter: NDKFilter = {
    kinds: [ExtendedNDKKind.FreelanceOrder],
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

export const allServices: NDKEventStore<ExtendedBaseType<ServiceEvent>> = get(
    ndk
).storeSubscribe<ServiceEvent>(allServicesFilter, subOptions, ServiceEvent);

export const allOrders: NDKEventStore<ExtendedBaseType<OrderEvent>> = get(
    ndk
).storeSubscribe<OrderEvent>(allOrdersFilter, subOptions, OrderEvent);

export const wotFilteredJobs = derived([allJobs, wot], ([$allJobs, $wot]) => {
    return $allJobs.filter((job: JobEvent) => $wot.has(job.pubkey));
});

export const wotFilteredBids = derived([allBids, wot], ([$allBids, $wot]) => {
    return $allBids.filter((bid: BidEvent) => $wot.has(bid.pubkey));
});

export const wotFilteredServices = derived([allServices, wot], ([$allServices, $wot]) => {
    return $allServices.filter((service: ServiceEvent) => $wot.has(service.pubkey));
});

export const wotFilteredOrders = derived([allOrders, wot], ([$allOrders, $wot]) => {
    return $allOrders.filter((order: OrderEvent) => $wot.has(order.pubkey));
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

export const myServices: NDKEventStore<ExtendedBaseType<ServiceEvent>> = get(
    ndk
).storeSubscribe<ServiceEvent>(myServiceFilter, subOptions, ServiceEvent);

export const myOrders: NDKEventStore<ExtendedBaseType<OrderEvent>> = get(
    ndk
).storeSubscribe<OrderEvent>(myOrderFilter, subOptions, OrderEvent);
