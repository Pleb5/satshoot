import type { Hexpubkey, NDKEvent } from '@nostr-dev-kit/ndk';
import type { JobEvent } from '$lib/events/JobEvent';
import type { BidEvent } from '$lib/events/BidEvent';

export interface FinancialData {
    earnings: number;
    payments: number;
    pledges: number;
}

export interface ReputationData {
    financial: FinancialData;
    clientAverage: number;
    freelancerAverage: number;
    overallAverage: number;
    isInitialized: boolean;
}

export interface JobBidContext {
    involvedJobEvents: JobEvent[];
    involvedBids: BidEvent[];
    winningBidsOfUser: string[];
    winningBidsForUser: string[];
    involvedJobs: string[];
}

export interface PledgeCalculationContext {
    job: JobEvent | undefined;
    bid: BidEvent | undefined;
}
