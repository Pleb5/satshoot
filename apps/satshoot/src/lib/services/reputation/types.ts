import type { Hexpubkey, NDKEvent } from '@nostr-dev-kit/ndk';
import type { JobEvent } from '$lib/events/JobEvent';
import type { BidEvent } from '$lib/events/BidEvent';
import type { ServiceEvent } from '$lib/events/ServiceEvent';
import type { OrderEvent } from '$lib/events/OrderEvent';
import type { UserAssertion } from '$lib/services/assertions/types';

export interface FinancialData {
    earnings: number;
    payments: number;
    pledges: number;
}

export interface AssertionData {
    rank?: number;
    followers?: number;
    zapAmtRecd?: number;
    zapAmtSent?: number;
    postCnt?: number;
    replyCnt?: number;
    reactionsCnt?: number;
    zapCntRecd?: number;
    zapCntSent?: number;
    zapAvgAmtDayRecd?: number;
    zapAvgAmtDaySent?: number;
    reportsCntRecd?: number;
    reportsCntSent?: number;
    firstCreatedAt?: number;
    activeHoursStart?: number;
    activeHoursEnd?: number;
    commonTopics?: string[];
    providerCount: number;
}

export interface ReputationData {
    financial: FinancialData;
    clientAverage: number;
    freelancerAverage: number;
    overallAverage: number;
    assertions?: AssertionData;
    isInitialized: boolean;
}

export interface JobBidContext {
    involvedJobEvents: JobEvent[];
    involvedBids: BidEvent[];
    winningBidsOfUser: string[];
    winningBidsForUser: string[];
    winningBidAddressesOfUser: string[];
    winningBidAddressesForUser: string[];
    involvedJobs: string[];
}

export interface ServiceOrderContext {
    involvedServiceEvents: ServiceEvent[];
    involvedOrderEvents: OrderEvent[];
    ordersOfUser: string[]; // all orders that user places on other people's services
    confirmOrders: string[]; // all order on user's services that are either in-progress or completed
    involvedOrders: string[]; // all orders where user is involved either as freelancer or client
}

export interface PledgeCalculationContext {
    job: JobEvent | undefined;
    bid: BidEvent | undefined;
}
