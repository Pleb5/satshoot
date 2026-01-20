import ndk from '$lib/stores/session';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';

import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';

import { get } from 'svelte/store';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { OrderEvent } from '$lib/events/OrderEvent';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

// Export necessary when restarting a subscription with a new filter
export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    groupable: false,
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
    { ...subOptions, autoStart: false },
    JobEvent
);

export const allBids: NDKEventStore<ExtendedBaseType<BidEvent>> = get(ndk).storeSubscribe<BidEvent>(
    allBidsFilter,
    { ...subOptions, autoStart: false },
    BidEvent
);

export const allServices: NDKEventStore<ExtendedBaseType<ServiceEvent>> = get(
    ndk
).storeSubscribe<ServiceEvent>(
    allServicesFilter,
    { ...subOptions, autoStart: false },
    ServiceEvent
);

export const allOrders: NDKEventStore<ExtendedBaseType<OrderEvent>> = get(
    ndk
).storeSubscribe<OrderEvent>(allOrdersFilter, { ...subOptions, autoStart: false }, OrderEvent);

export const myJobs: NDKEventStore<ExtendedBaseType<JobEvent>> = get(ndk).storeSubscribe<JobEvent>(
    myJobFilter,
    { ...subOptions, autoStart: false },
    JobEvent
);

export const myBids: NDKEventStore<ExtendedBaseType<BidEvent>> = get(ndk).storeSubscribe<BidEvent>(
    myBidFilter,
    { ...subOptions, autoStart: false },
    BidEvent
);

export const myServices: NDKEventStore<ExtendedBaseType<ServiceEvent>> = get(
    ndk
).storeSubscribe<ServiceEvent>(myServiceFilter, { ...subOptions, autoStart: false }, ServiceEvent);

export const myOrders: NDKEventStore<ExtendedBaseType<OrderEvent>> = get(
    ndk
).storeSubscribe<OrderEvent>(myOrderFilter, { ...subOptions, autoStart: false }, OrderEvent);
