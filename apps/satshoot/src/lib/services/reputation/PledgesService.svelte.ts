import {
    NDKKind,
    NDKSubscriptionCacheUsage,
    zapInvoiceFromEvent,
    NDKNutzap,
    type NDKFilter,
    type NDKEvent,
    type Hexpubkey,
} from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';
import { get } from 'svelte/store';
import { SatShootPubkey } from '$lib/utils/misc';
import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';
import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';

/**
 * Service for handling user pledges calculations
 */
export class PledgesService {
    // Private properties
    private pledgesStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    private user: Hexpubkey;
    private pledgesFilter: NDKFilter;
    private involvedJobEvents: JobEvent[] = [];
    private involvedBids: BidEvent[] = [];

    // Reactive state
    pledges = $state(0);

    constructor(user: Hexpubkey) {
        this.user = user;
        this.pledgesFilter = {
            kinds: [NDKKind.Zap, NDKKind.Nutzap],
        };

        const ndkInstance = get(ndk);
        this.pledgesStore = ndkInstance.storeSubscribe(this.pledgesFilter, {
            autoStart: false,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        });

        this.pledgesStore.subscribe((ndkEvents) => {
            this.pledges = this.calculatePledges(
                ndkEvents,
                this.involvedJobEvents,
                this.involvedBids,
                this.user
            );
        });
    }

    /**
     * Initialize pledges tracking for the user
     */
    initialize(involvedJobs: string[], involvedJobEvents: JobEvent[], involvedBids: BidEvent[]) {
        this.involvedJobEvents = involvedJobEvents;
        this.involvedBids = involvedBids;

        // Update filter for pledges
        this.pledgesFilter['#a'] = involvedJobs;
        this.pledgesFilter['#p'] = [SatShootPubkey];

        this.pledgesStore.startSubscription();
    }

    /**
     * Get current pledges using reactive state
     */
    getPledges(): number {
        return this.pledges;
    }

    /**
     * Calculates the total pledges for a user by processing a list of NDK events (zaps or nutzaps).
     * It sums up the user's share of pledges based on their role (client or freelancer) in the associated jobs and bids.
     *
     * @param events - An array of NDKEvent objects representing zaps or nutzaps.
     * @param jobs - An array of JobEvent objects representing jobs.
     * @param bids - An array of BidEvent objects representing bids.
     * @param user - The hexpubkey of the user for whom the pledges are being calculated.
     * @returns The total amount of pledges (in sats) that the user is entitled to.
     */
    private calculatePledges(
        events: NDKEvent[],
        jobs: JobEvent[],
        bids: BidEvent[],
        user: Hexpubkey
    ): number {
        return events.reduce((total, zap) => {
            // Calculate the total amount of the zap/nutzap in sats
            const pledgeSum = this.calculatePledgeSum(zap);
            if (pledgeSum > 0) {
                // Find the associated job and bid for the zap/nutzap
                const { job, bid } = this.getJobAndBid(zap, jobs, bids);
                if (job && bid) {
                    // Calculate the user's share of the pledge based on their role
                    const userShare = this.calculateUserShare(pledgeSum, job, bid, user);
                    return total + userShare;
                }
            }
            return total;
        }, 0);
    }

    /**
     * Calculates the total amount of a zap or nutzap event in sats.
     *
     * @param zap - An NDKEvent object representing a zap or nutzap.
     * @returns The amount of the zap/nutzap in sats, or 0 if the amount is invalid or the event is not a zap/nutzap.
     */
    private calculatePledgeSum(zap: NDKEvent): number {
        if (zap.kind === NDKKind.Zap) {
            // Extract the zap invoice and return the amount in sats
            const zapInvoice = zapInvoiceFromEvent(zap);
            return zapInvoice?.amount ? Math.round(zapInvoice.amount / 1000) : 0;
        } else if (zap.kind === NDKKind.Nutzap) {
            // Extract the nutzap and return the amount in sats
            const nutzap = NDKNutzap.from(zap);
            return nutzap?.amount ? Math.round(nutzap.amount / 1000) : 0;
        }
        return 0;
    }

    /**
     * Finds the job and bid associated with a zap/nutzap event.
     *
     * @param zap - An NDKEvent object representing a zap or nutzap.
     * @param jobs - An array of JobEvent objects representing jobs.
     * @param bids - An array of BidEvent objects representing bids.
     * @returns An object containing the associated job and bid, or undefined if not found.
     */
    private getJobAndBid(
        zap: NDKEvent,
        jobs: JobEvent[],
        bids: BidEvent[]
    ): { job: JobEvent | undefined; bid: BidEvent | undefined } {
        // Find the job associated with the zap/nutzap using the 'a' tag
        const job = jobs.find((j) => j.jobAddress === zap.tagValue('a'));
        // Find the bid associated with the job's accepted bid address
        const bid = bids.find((b) => b.bidAddress === job?.acceptedBidAddress);
        return { job, bid };
    }

    /**
     * Calculates the user's share of a pledge based on their role (client or freelancer).
     *
     * @param pledgeSum - The total amount of the pledge in sats.
     * @param job - The JobEvent object associated with the pledge.
     * @param bid - The BidEvent object associated with the pledge.
     * @param user - The hexpubkey of the user for whom the share is being calculated.
     * @returns The user's share of the pledge in sats.
     */
    private calculateUserShare(
        pledgeSum: number,
        job: JobEvent,
        bid: BidEvent,
        user: Hexpubkey
    ): number {
        // Calculate the absolute pledge split based on the bid's pledgeSplit percentage
        const absolutePledgeSplit = Math.round((bid.pledgeSplit / 100) * pledgeSum);
        // If the user is the client, they get the remaining amount after the freelancer's split
        // If the user is the freelancer, they get the pledge split
        return job.pubkey === user ? pledgeSum - absolutePledgeSplit : absolutePledgeSplit;
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        if (this.pledgesStore) {
            this.pledgesStore.empty();
        }
    }
}
