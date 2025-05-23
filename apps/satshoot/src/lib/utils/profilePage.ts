import { BidEvent, BidStatus } from '$lib/events/BidEvent';
import { JobEvent, JobStatus } from '$lib/events/JobEvent';
import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
import { ServiceEvent, ServiceStatus } from '$lib/events/ServiceEvent';
import { UserMode } from '$lib/stores/user';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import Fuse from 'fuse.js';

/**
 * Creates a search function using Fuse.js for a given configuration
 */
export function createSearchFunction<T extends NDKEvent>(searchConfig: {
    keys: Array<{ name: string; weight: number }>;
}) {
    return function search(items: T[], searchTerm: string): T[] {
        const fuse = new Fuse(items, {
            isCaseSensitive: false,
            shouldSort: true,
            ignoreLocation: true,
            threshold: 0.6,
            minMatchCharLength: 2,
            keys: searchConfig.keys,
        });

        const searchResult = fuse.search(searchTerm);
        return searchResult.map(({ item }) => item);
    };
}

/**
 * Status filter function for Jobs
 */
export function jobStatusFilter(
    job: JobEvent,
    filterState: { new: boolean; inProgress: boolean; closed: boolean }
): boolean {
    const { status } = job;
    return (
        (filterState.new && status === JobStatus.New) ||
        (filterState.inProgress && status === JobStatus.InProgress) ||
        (filterState.closed && (status === JobStatus.Resolved || status === JobStatus.Failed))
    );
}

/**
 * Status filter function for Services
 */
export function serviceStatusFilter(
    service: ServiceEvent,
    filterState: { active: boolean; inActive: boolean }
): boolean {
    const { status } = service;
    return (
        (filterState.active && status === ServiceStatus.Active) ||
        (filterState.inActive && status === ServiceStatus.InActive)
    );
}

/**
 * Status filter function for Bids
 * This requires applied jobs to determine the bid status
 */
export function createBidStatusFilter(appliedJobs: JobEvent[]) {
    return function bidStatusFilter(
        bid: BidEvent,
        filterState: { pending: boolean; success: boolean; lost: boolean }
    ): boolean {
        const job = appliedJobs?.find((job) => job.jobAddress === bid.referencedJobAddress);

        const bidStatus = job
            ? job.acceptedBidAddress
                ? job.acceptedBidAddress === bid.bidAddress
                    ? BidStatus.Won
                    : BidStatus.Lost
                : BidStatus.Pending
            : BidStatus.Pending; // Default to Pending if job not found

        return (
            (filterState.pending && bidStatus === BidStatus.Pending) ||
            (filterState.success && bidStatus === BidStatus.Won) ||
            (filterState.lost && bidStatus === BidStatus.Lost)
        );
    };
}

/**
 * Status filter function for Orders
 * This requires applied services to determine the order status
 */
export function createOrderStatusFilter(appliedServices: ServiceEvent[]) {
    return function orderStatusFilter(
        order: OrderEvent,
        filterState: { pending: boolean; inProgress: boolean; completed: boolean }
    ): boolean {
        const service = appliedServices?.find(
            (service) => service.serviceAddress === order.referencedServiceAddress
        );

        const orderStatus =
            order.status === OrderStatus.Open
                ? service?.orders.includes(order.orderAddress)
                    ? 'in-progress'
                    : 'pending'
                : 'completed';

        return (
            (filterState.pending && orderStatus === 'pending') ||
            (filterState.inProgress && orderStatus === 'in-progress') ||
            (filterState.completed && orderStatus === 'completed')
        );
    };
}

/**
 * Determines the order of components based on user mode and profile ownership
 */
export function getComponentOrder(
    isOwnProfile: boolean,
    userMode: UserMode
): {
    first: 'ServicesAndBids' | 'OrdersAndJobs';
    second: 'ServicesAndBids' | 'OrdersAndJobs';
} {
    if (userMode === UserMode.Freelancer) {
        if (isOwnProfile) {
            return { first: 'ServicesAndBids', second: 'OrdersAndJobs' };
        } else {
            return { first: 'OrdersAndJobs', second: 'ServicesAndBids' };
        }
    } else if (isOwnProfile) {
        return { first: 'OrdersAndJobs', second: 'ServicesAndBids' };
    } else {
        return { first: 'ServicesAndBids', second: 'OrdersAndJobs' };
    }
}
