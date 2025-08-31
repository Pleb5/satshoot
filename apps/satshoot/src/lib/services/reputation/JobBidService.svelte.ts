import { NDKSubscriptionCacheUsage, type Hexpubkey } from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';
import { get } from 'svelte/store';
import { wot } from '$lib/stores/wot';
import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';
import type { JobBidContext } from './types';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

/**
 * Service for fetching and processing job and bid data
 */
export class JobBidService {
    private user: Hexpubkey;

    constructor(user: Hexpubkey) {
        this.user = user;
    }

    /**
     * Initialize and fetch all job and bid data for the user
     */
    async initialize(): Promise<JobBidContext> {
        const subOptions = {
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        };

        const winningBidsOfUser: string[] = [];
        const winningBidsForUser: string[] = [];
        const involvedJobs: string[] = [];
        const involvedJobEvents: JobEvent[] = [];
        const involvedBids: BidEvent[] = [];

        // Process user's bids (earnings)
        await this.processUserBids(
            subOptions,
            winningBidsOfUser,
            involvedJobs,
            involvedJobEvents,
            involvedBids
        );

        // Process user's jobs (payments)
        await this.processUserJobs(
            subOptions,
            winningBidsForUser,
            involvedJobs,
            involvedJobEvents,
            involvedBids
        );

        return {
            involvedJobEvents,
            involvedBids,
            winningBidsOfUser,
            winningBidsForUser,
            involvedJobs,
        };
    }

    /**
     * Process user's bids to find winning bids (for earnings calculation)
     */
    private async processUserBids(
        subOptions: any,
        winningBidsOfUser: string[],
        involvedJobs: string[],
        involvedJobEvents: JobEvent[],
        involvedBids: BidEvent[]
    ) {
        const ndkInstance = get(ndk);
        const wotStore = get(wot);

        // Get user's bids
        const userBids = await ndkInstance.fetchEvents(
            {
                kinds: [ExtendedNDKKind.FreelanceBid],
                authors: [this.user],
            },
            subOptions
        );

        // Get jobs where user's bids won
        const allJobsUserWon = await ndkInstance.fetchEvents(
            {
                kinds: [ExtendedNDKKind.FreelanceJob],
                '#a': Array.from(userBids).map((o) => o.tagAddress()),
            },
            subOptions
        );

        for (const wonJob of allJobsUserWon) {
            const jobEvent = JobEvent.from(wonJob);
            if (wotStore.has(jobEvent.pubkey)) {
                const bidOfJob = Array.from(userBids).find(
                    (o) => o.tagAddress() === jobEvent.acceptedBidAddress
                );
                if (bidOfJob) {
                    involvedJobs.push(jobEvent.jobAddress);
                    winningBidsOfUser.push(bidOfJob.id);

                    involvedJobEvents.push(jobEvent);
                    involvedBids.push(BidEvent.from(bidOfJob));
                } else {
                    console.error('BUG: Bid for this job SHOULD be found');
                }
            }
        }
    }

    /**
     * Process user's jobs to find winning bids (for payments calculation)
     */
    private async processUserJobs(
        subOptions: any,
        winningBidsForUser: string[],
        involvedJobs: string[],
        involvedJobEvents: JobEvent[],
        involvedBids: BidEvent[]
    ) {
        const ndkInstance = get(ndk);
        const wotStore = get(wot);

        // Get user's jobs
        const userJobs = await ndkInstance.fetchEvents(
            {
                kinds: [ExtendedNDKKind.FreelanceJob],
                authors: [this.user],
            },
            subOptions
        );

        // Get winning bids on user's jobs
        const allWinningBidsOnUserJobs = await ndkInstance.fetchEvents(
            {
                kinds: [ExtendedNDKKind.FreelanceBid],
                '#a': Array.from(userJobs).map((t) => t.tagAddress()),
            },
            subOptions
        );

        for (const bid of allWinningBidsOnUserJobs) {
            const bidEvent = BidEvent.from(bid);
            if (wotStore.has(bidEvent.pubkey)) {
                const jobOfBid = Array.from(userJobs).find(
                    (t) => t.tagAddress() === bidEvent.referencedJobAddress
                );
                if (jobOfBid) {
                    involvedJobs.push(jobOfBid.tagAddress());
                    winningBidsForUser.push(bidEvent.id);

                    involvedJobEvents.push(JobEvent.from(jobOfBid));
                    involvedBids.push(bidEvent);
                } else {
                    console.error('BUG: Job for this bid SHOULD be found');
                }
            }
        }
    }
}
