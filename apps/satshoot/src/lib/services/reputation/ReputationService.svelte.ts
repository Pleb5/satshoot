import { aggregateClientRatings, aggregateFreelancerRatings } from '$lib/stores/reviews';
import type { Hexpubkey } from '@nostr-dev-kit/ndk';
import type { ReputationData } from './types';
import { EarningsService } from './EarningsService.svelte';
import { PaymentsService } from './PaymentsService.svelte';
import { PledgesService } from './PledgesService.svelte';
import { JobBidService } from './JobBidService.svelte';

/**
 * Main service for handling user reputation data including financial metrics and reviews
 */
export class ReputationService {
    // Public state
    isInitialized = $state(false);

    clientAverage = $state<number>(NaN);
    freelancerAverage = $state<number>(NaN);
    overallAverage = $state<number>(NaN);

    // Private services
    private earningsService: EarningsService;
    private paymentsService: PaymentsService;
    private pledgesService: PledgesService;
    private jobBidService: JobBidService;
    private user: Hexpubkey;

    constructor(user: Hexpubkey) {
        this.user = user;
        this.earningsService = new EarningsService(user);
        this.paymentsService = new PaymentsService(user);
        this.pledgesService = new PledgesService(user);
        this.jobBidService = new JobBidService(user);
    }

    /**
     * Calculate overall average rating
     */
    private getOverallAverage(): number {
        const clientAvg = this.clientAverage;
        const freelancerAvg = this.freelancerAverage;

        if (!isNaN(clientAvg) && !isNaN(freelancerAvg)) {
            return (clientAvg + freelancerAvg) / 2;
        } else if (isNaN(clientAvg) && !isNaN(freelancerAvg)) {
            return freelancerAvg;
        } else if (isNaN(freelancerAvg) && !isNaN(clientAvg)) {
            return clientAvg;
        } else {
            return NaN;
        }
    }

    /**
     * Initialize all reputation services
     */
    public async initialize() {
        try {
            // Fetch job and bid context
            const context = await this.jobBidService.initialize();

            // Initialize individual services
            this.earningsService.initialize(context.winningBidsOfUser);
            this.paymentsService.initialize(context.winningBidsForUser);
            this.pledgesService.initialize(
                context.involvedJobs,
                context.involvedJobEvents,
                context.involvedBids
            );

            this.clientAverage = aggregateClientRatings(this.user).average;
            this.freelancerAverage = aggregateFreelancerRatings(this.user).average;
            this.overallAverage = this.getOverallAverage();

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize reputation service:', error);
        }
    }

    /**
     * Get current earnings - reactive getter
     */
    get earnings(): number {
        return this.earningsService.getEarnings();
    }

    /**
     * Get current payments - reactive getter
     */
    get payments(): number {
        return this.paymentsService.getPayments();
    }

    /**
     * Get current pledges - reactive getter
     */
    get pledges(): number {
        return this.pledgesService.getPledges();
    }

    /**
     * Get complete reputation data - reactive
     */
    get reputationData(): ReputationData {
        return {
            financial: {
                earnings: this.earnings,
                payments: this.payments,
                pledges: this.pledges,
            },
            clientAverage: this.clientAverage,
            freelancerAverage: this.freelancerAverage,
            overallAverage: this.overallAverage,
            isInitialized: this.isInitialized,
        };
    }

    /**
     * Get financial items array (for UI display) - reactive
     */
    get financialItems() {
        return [
            {
                title: 'The total amount of money this user has received for completing jobs',
                label: 'Earnings',
                amount: this.earnings,
            },
            {
                title: 'The total amount of money this user has paid freelancers that completed their jobs',
                label: 'Payments',
                amount: this.payments,
            },
            {
                title: 'The total amount of money this user has donated to help the development & maintenance of SatShoot',
                label: 'Pledges',
                amount: this.pledges,
            },
        ];
    }

    /**
     * Clean up all services
     */
    destroy() {
        this.earningsService.destroy();
        this.paymentsService.destroy();
        this.pledgesService.destroy();
    }
}
