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

        // Initialize when session is ready
        $effect(() => {
            const sessionReady = get(sessionInitialized);
            if (sessionReady) {
                this.initialize();
            }
        });
    }

    /**
     * Initialize all reputation services
     */
    private async initialize() {
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
     * Get current earnings
     */
    getEarnings(): number {
        return this.earningsService.getEarnings();
    }

    /**
     * Get current payments
     */
    getPayments(): number {
        return this.paymentsService.getPayments();
    }

    /**
     * Get current pledges
     */
    getPledges(): number {
        return this.pledgesService.getPledges();
    }

    /**
     * Get client average rating
     */
    getClientAverage(): number {
        return aggregateClientRatings(this.user).average;
    }

    /**
     * Get freelancer average rating
     */
    getFreelancerAverage(): number {
        return aggregateFreelancerRatings(this.user).average;
    }

    /**
     * Calculate overall average rating
     */
    getOverallAverage(): number {
        const clientAverage = this.getClientAverage();
        const freelancerAverage = this.getFreelancerAverage();

        if (!isNaN(clientAverage) && !isNaN(freelancerAverage)) {
            return (clientAverage + freelancerAverage) / 2;
        } else if (isNaN(clientAverage) && !isNaN(freelancerAverage)) {
            return freelancerAverage;
        } else if (isNaN(freelancerAverage) && !isNaN(clientAverage)) {
            return clientAverage;
        } else {
            return NaN;
        }
    }

    /**
     * Get complete reputation data
     */
    getReputationData(): ReputationData {
        return {
            financial: {
                earnings: this.getEarnings(),
                payments: this.getPayments(),
                pledges: this.getPledges(),
            },
            clientAverage: this.getClientAverage(),
            freelancerAverage: this.getFreelancerAverage(),
            overallAverage: this.getOverallAverage(),
            isInitialized: this.isInitialized,
        };
    }

    /**
     * Get financial items array (for UI display)
     */
    getFinancialItems() {
        return [
            {
                title: 'The total amount of money this user has received for completing jobs',
                label: 'Earnings',
                amount: this.getEarnings(),
            },
            {
                title: 'The total amount of money this user has paid freelancers that completed their jobs',
                label: 'Payments',
                amount: this.getPayments(),
            },
            {
                title: 'The total amount of money this user has donated to help the development & maintenance of SatShoot',
                label: 'Pledges',
                amount: this.getPledges(),
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
