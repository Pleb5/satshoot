import { get } from 'svelte/store';
import { sessionInitialized } from '$lib/stores/session';
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
     * Get client average rating - reactive derived
     */
    get clientAverage(): number {
        return aggregateClientRatings(this.user).average;
    }

    /**
     * Get freelancer average rating - reactive derived
     */
    get freelancerAverage(): number {
        return aggregateFreelancerRatings(this.user).average;
    }

    /**
     * Calculate overall average rating - reactive derived
     */
    get overallAverage(): number {
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
     * Legacy method wrappers for backward compatibility
     */
    getEarnings(): number {
        return this.earnings;
    }

    getPayments(): number {
        return this.payments;
    }

    getPledges(): number {
        return this.pledges;
    }

    getClientAverage(): number {
        return this.clientAverage;
    }

    getFreelancerAverage(): number {
        return this.freelancerAverage;
    }

    getOverallAverage(): number {
        return this.overallAverage;
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
     * Legacy method wrappers for backward compatibility
     */
    getReputationData(): ReputationData {
        return this.reputationData;
    }

    getFinancialItems() {
        return this.financialItems;
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
