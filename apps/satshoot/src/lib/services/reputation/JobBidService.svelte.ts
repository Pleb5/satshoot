import { NDKSubscriptionCacheUsage, type Hexpubkey, type NDKFilter } from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';
import { get, writable, type Unsubscriber } from 'svelte/store';
import { wot } from '$lib/stores/wot';
import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';
import type { JobBidContext } from './types';
import { ExtendedNDKKind } from '$lib/types/ndkKind';
import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';

/**
 * Service for fetching and processing job and bid data
 */
export class JobBidService {
    private user: Hexpubkey;
    private contextStore = writable<JobBidContext>({
        involvedJobEvents: [],
        involvedBids: [],
        winningBidsOfUser: [],
        winningBidsForUser: [],
        winningBidAddressesOfUser: [],
        winningBidAddressesForUser: [],
        involvedJobs: [],
    });
    private subscriptionsStarted = false;
    private storeUnsubs: Unsubscriber[] = [];
    private wotUnsub?: Unsubscriber;

    private userJobsStore?: NDKEventStore<ExtendedBaseType<JobEvent>>;
    private userBidsStore?: NDKEventStore<ExtendedBaseType<BidEvent>>;
    private jobsForUserBidsStore?: NDKEventStore<ExtendedBaseType<JobEvent>>;
    private bidsOnUserJobsStore?: NDKEventStore<ExtendedBaseType<BidEvent>>;

    private jobsForUserBidsFilter: NDKFilter[] = [
        {
            kinds: [ExtendedNDKKind.FreelanceJob],
            '#a': [],
        },
    ];
    private bidsOnUserJobsFilter: NDKFilter[] = [
        {
            kinds: [ExtendedNDKKind.FreelanceBid],
            '#a': [],
        },
    ];

    private currentUserJobs: JobEvent[] = [];
    private currentUserBids: BidEvent[] = [];
    private currentJobsForUserBids: JobEvent[] = [];
    private currentBidsOnUserJobs: BidEvent[] = [];
    private currentWot = new Set<Hexpubkey>();
    private lastJobsFilterKey = '';
    private lastBidsFilterKey = '';
    private jobsForUserBidsStarted = false;
    private bidsOnUserJobsStarted = false;

    constructor(user: Hexpubkey) {
        this.user = user;
    }

    subscribe(run: (context: JobBidContext) => void): Unsubscriber {
        return this.contextStore.subscribe(run);
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
        const winningBidAddressesOfUser: string[] = [];
        const winningBidAddressesForUser: string[] = [];
        const involvedJobs: string[] = [];
        const involvedJobEvents: JobEvent[] = [];
        const involvedBids: BidEvent[] = [];

        // Process user's bids (earnings)
        await this.processUserBids(
            subOptions,
            winningBidsOfUser,
            winningBidAddressesOfUser,
            involvedJobs,
            involvedJobEvents,
            involvedBids
        );

        // Process user's jobs (payments)
        await this.processUserJobs(
            subOptions,
            winningBidsForUser,
            winningBidAddressesForUser,
            involvedJobs,
            involvedJobEvents,
            involvedBids
        );

        const context = this.normalizeContext({
            involvedJobEvents,
            involvedBids,
            winningBidsOfUser,
            winningBidsForUser,
            winningBidAddressesOfUser,
            winningBidAddressesForUser,
            involvedJobs,
        });

        this.contextStore.set(context);
        this.startSubscriptions();

        return context;
    }

    private normalizeContext(context: JobBidContext): JobBidContext {
        const jobEvents = new Map<string, JobEvent>();
        const bidEvents = new Map<string, BidEvent>();

        context.involvedJobEvents.forEach((job) => {
            jobEvents.set(job.jobAddress, job);
        });

        context.involvedBids.forEach((bid) => {
            bidEvents.set(bid.bidAddress, bid);
        });

        return {
            involvedJobEvents: Array.from(jobEvents.values()),
            involvedBids: Array.from(bidEvents.values()),
            winningBidsOfUser: Array.from(new Set(context.winningBidsOfUser)).filter(Boolean),
            winningBidsForUser: Array.from(new Set(context.winningBidsForUser)).filter(Boolean),
            winningBidAddressesOfUser: Array.from(new Set(context.winningBidAddressesOfUser)).filter(Boolean),
            winningBidAddressesForUser: Array.from(new Set(context.winningBidAddressesForUser)).filter(
                Boolean
            ),
            involvedJobs: Array.from(new Set(context.involvedJobs)).filter(Boolean),
        };
    }

    /**
     * Process user's bids to find winning bids (for earnings calculation)
     */
    private async processUserBids(
        subOptions: any,
        winningBidsOfUser: string[],
        winningBidAddressesOfUser: string[],
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
                    const bidEvent = BidEvent.from(bidOfJob);
                    involvedJobs.push(jobEvent.jobAddress);
                    winningBidsOfUser.push(bidOfJob.id);
                    winningBidAddressesOfUser.push(bidEvent.bidAddress);

                    involvedJobEvents.push(jobEvent);
                    involvedBids.push(bidEvent);
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
        winningBidAddressesForUser: string[],
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
                    winningBidAddressesForUser.push(bidEvent.bidAddress);

                    involvedJobEvents.push(JobEvent.from(jobOfBid));
                    involvedBids.push(bidEvent);
                } else {
                    console.error('BUG: Job for this bid SHOULD be found');
                }
            }
        }
    }

    private startSubscriptions() {
        if (this.subscriptionsStarted) return;
        this.subscriptionsStarted = true;

        const ndkInstance = get(ndk);
        const subOptions = {
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            closeOnEose: false,
            groupable: false,
            autoStart: false,
        };

        this.userJobsStore = ndkInstance.storeSubscribe<JobEvent>(
            {
                kinds: [ExtendedNDKKind.FreelanceJob],
                authors: [this.user],
            },
            subOptions,
            JobEvent
        );

        this.userBidsStore = ndkInstance.storeSubscribe<BidEvent>(
            {
                kinds: [ExtendedNDKKind.FreelanceBid],
                authors: [this.user],
            },
            subOptions,
            BidEvent
        );

        this.jobsForUserBidsStore = ndkInstance.storeSubscribe<JobEvent>(
            this.jobsForUserBidsFilter,
            subOptions,
            JobEvent
        );

        this.bidsOnUserJobsStore = ndkInstance.storeSubscribe<BidEvent>(
            this.bidsOnUserJobsFilter,
            subOptions,
            BidEvent
        );

        this.userJobsStore.startSubscription();
        this.userBidsStore.startSubscription();
        this.storeUnsubs.push(
            this.userJobsStore.subscribe((jobs) => {
                this.currentUserJobs = jobs;
                this.updateBidsOnUserJobsFilter(jobs);
                this.recomputeContext();
            })
        );

        this.storeUnsubs.push(
            this.userBidsStore.subscribe((bids) => {
                this.currentUserBids = bids;
                this.updateJobsForUserBidsFilter(bids);
                this.recomputeContext();
            })
        );

        this.storeUnsubs.push(
            this.jobsForUserBidsStore.subscribe((jobs) => {
                this.currentJobsForUserBids = jobs;
                this.recomputeContext();
            })
        );

        this.storeUnsubs.push(
            this.bidsOnUserJobsStore.subscribe((bids) => {
                this.currentBidsOnUserJobs = bids;
                this.recomputeContext();
            })
        );

        this.wotUnsub = wot.subscribe((set) => {
            this.currentWot = set;
            this.recomputeContext();
        });
    }

    private updateJobsForUserBidsFilter(userBids: BidEvent[]) {
        if (!this.jobsForUserBidsStore) return;
        const bidAddresses = Array.from(new Set(userBids.map((bid) => bid.bidAddress)));
        const nextKey = [...bidAddresses].sort().join('|');
        if (nextKey === this.lastBidsFilterKey) return;
        this.lastBidsFilterKey = nextKey;
        if (bidAddresses.length === 0) {
            this.jobsForUserBidsStore.empty();
            this.jobsForUserBidsStore.unsubscribe?.();
            this.jobsForUserBidsStarted = false;
            this.currentJobsForUserBids = [];
            this.recomputeContext();
            return;
        }
        this.jobsForUserBidsFilter[0]['#a'] = bidAddresses;
        this.jobsForUserBidsStore.changeFilters?.(this.jobsForUserBidsFilter);
        this.jobsForUserBidsStore.startSubscription();
        this.jobsForUserBidsStarted = true;
    }

    private updateBidsOnUserJobsFilter(userJobs: JobEvent[]) {
        if (!this.bidsOnUserJobsStore) return;
        const jobAddresses = Array.from(new Set(userJobs.map((job) => job.jobAddress)));
        const nextKey = [...jobAddresses].sort().join('|');
        if (nextKey === this.lastJobsFilterKey) return;
        this.lastJobsFilterKey = nextKey;
        if (jobAddresses.length === 0) {
            this.bidsOnUserJobsStore.empty();
            this.bidsOnUserJobsStore.unsubscribe?.();
            this.bidsOnUserJobsStarted = false;
            this.currentBidsOnUserJobs = [];
            this.recomputeContext();
            return;
        }
        this.bidsOnUserJobsFilter[0]['#a'] = jobAddresses;
        this.bidsOnUserJobsStore.changeFilters?.(this.bidsOnUserJobsFilter);
        this.bidsOnUserJobsStore.startSubscription();
        this.bidsOnUserJobsStarted = true;
    }

    private recomputeContext() {
        const involvedJobs = new Map<string, JobEvent>();
        const involvedBids = new Map<string, BidEvent>();
        const winningBidsOfUser = new Set<string>();
        const winningBidsForUser = new Set<string>();
        const winningBidAddressesOfUser = new Set<string>();
        const winningBidAddressesForUser = new Set<string>();

        const bidsByAddress = new Map<string, BidEvent>();
        for (const bid of this.currentUserBids) {
            bidsByAddress.set(bid.bidAddress, bid);
        }

        const jobsByAddress = new Map<string, JobEvent>();
        for (const job of this.currentUserJobs) {
            jobsByAddress.set(job.jobAddress, job);
        }

        for (const job of this.currentJobsForUserBids) {
            if (!this.currentWot.has(job.pubkey)) continue;
            const bidAddress = job.acceptedBidAddress;
            if (!bidAddress) continue;
            const bid = bidsByAddress.get(bidAddress);
            if (!bid) continue;
            involvedJobs.set(job.jobAddress, job);
            involvedBids.set(bid.bidAddress, bid);
            winningBidsOfUser.add(bid.id);
            winningBidAddressesOfUser.add(bid.bidAddress);
        }

        for (const bid of this.currentBidsOnUserJobs) {
            if (!this.currentWot.has(bid.pubkey)) continue;
            const job = jobsByAddress.get(bid.referencedJobAddress);
            if (!job) continue;
            involvedJobs.set(job.jobAddress, job);
            involvedBids.set(bid.bidAddress, bid);
            winningBidsForUser.add(bid.id);
            winningBidAddressesForUser.add(bid.bidAddress);
        }

        this.contextStore.set({
            involvedJobEvents: Array.from(involvedJobs.values()),
            involvedBids: Array.from(involvedBids.values()),
            winningBidsOfUser: Array.from(winningBidsOfUser),
            winningBidsForUser: Array.from(winningBidsForUser),
            winningBidAddressesOfUser: Array.from(winningBidAddressesOfUser),
            winningBidAddressesForUser: Array.from(winningBidAddressesForUser),
            involvedJobs: Array.from(involvedJobs.keys()),
        });
    }

    destroy() {
        this.storeUnsubs.forEach((unsub) => unsub());
        this.storeUnsubs = [];
        if (this.wotUnsub) {
            this.wotUnsub();
            this.wotUnsub = undefined;
        }
        this.subscriptionsStarted = false;
        this.userJobsStore?.unsubscribe?.();
        this.userBidsStore?.unsubscribe?.();
        this.jobsForUserBidsStore?.unsubscribe?.();
        this.bidsOnUserJobsStore?.unsubscribe?.();
        this.jobsForUserBidsStarted = false;
        this.bidsOnUserJobsStarted = false;

        this.userJobsStore?.empty();
        this.userBidsStore?.empty();
        this.jobsForUserBidsStore?.empty();
        this.bidsOnUserJobsStore?.empty();
    }
}
