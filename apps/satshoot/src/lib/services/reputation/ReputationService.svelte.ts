import { aggregateClientRatings, aggregateFreelancerRatings } from '$lib/stores/reviews';
import type { Hexpubkey } from '@nostr-dev-kit/ndk';
import type { ReputationData, AssertionData } from './types';
import type { JobBidContext, ServiceOrderContext } from './types';
import { EarningsService } from './EarningsService.svelte';
import { PaymentsService } from './PaymentsService.svelte';
import { PledgesService } from './PledgesService.svelte';
import { JobBidService } from './JobBidService.svelte';
import { ServiceOrderService } from './ServiceOrderService.svelte';
import type { Unsubscriber } from 'svelte/store';
import { AssertionService } from '$lib/services/assertions/AssertionService.svelte';
import type { UserAssertion } from '$lib/services/assertions/types';
import { get } from 'svelte/store';
import { selectedProviders } from '$lib/stores/assertions';
import ndk from '$lib/stores/session';

/**
 * Main service for handling user reputation data including financial metrics and reviews
 */
export class ReputationService {
    // Public state
    isInitialized = $state(false);

    clientAverage = $state<number>(NaN);
    freelancerAverage = $state<number>(NaN);
    overallAverage = $state<number>(NaN);
    assertionData = $state<AssertionData | undefined>(undefined);

    // Private services
    private earningsService: EarningsService;
    private paymentsService: PaymentsService;
    private pledgesService: PledgesService;
    private jobBidService: JobBidService;
    private serviceOrderService: ServiceOrderService;
    private assertionService?: AssertionService;
    private user: Hexpubkey;
    private jobContext?: JobBidContext;
    private serviceContext?: ServiceOrderContext;
    private contextUnsubs: Unsubscriber[] = [];
    private userAssertions?: Map<string, UserAssertion>;

    constructor(user: Hexpubkey) {
        this.user = user;
        this.earningsService = new EarningsService(user);
        this.paymentsService = new PaymentsService(user);
        this.pledgesService = new PledgesService(user);
        this.jobBidService = new JobBidService(user);
        this.serviceOrderService = new ServiceOrderService(user);
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
            const jobContext = await this.jobBidService.initialize();

            // Fetch service and order context
            const serviceContext = await this.serviceOrderService.initialize();

            this.jobContext = jobContext;
            this.serviceContext = serviceContext;

            // Initialize individual services
            this.applyContexts();

            this.attachContextSubscriptions();

            this.clientAverage = aggregateClientRatings(this.user).average;
            this.freelancerAverage = aggregateFreelancerRatings(this.user).average;
            this.overallAverage = this.getOverallAverage();

            // Initialize assertion service if providers are configured
            await this.initializeAssertions();

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize reputation service:', error);
        }
    }

    /**
     * Initialize assertion service and fetch user assertions
     */
    private async initializeAssertions() {
        try {
            const providers = get(selectedProviders);

            if (providers.length === 0) {
                // No providers configured
                this.assertionData = undefined;
                return;
            }

            const $ndk = get(ndk);
            if (!$ndk) {
                console.warn('NDK not available for assertions');
                return;
            }

            this.assertionService = new AssertionService($ndk);

            // Fetch assertions from configured providers
            this.userAssertions = await this.assertionService.fetchUserAssertions(
                this.user,
                providers
            );

            // Aggregate assertion data
            this.assertionData = this.aggregateAssertions(this.userAssertions);
        } catch (error) {
            console.warn('Failed to initialize assertions:', error);
            this.assertionData = undefined;
        }
    }

    /**
     * Aggregate user assertions into displayable data
     */
    private aggregateAssertions(assertions: Map<string, UserAssertion>): AssertionData {
        if (!this.assertionService || assertions.size === 0) {
            return { providerCount: 0 };
        }

        const data: AssertionData = {
            providerCount: assertions.size,
        };

        // Aggregate rank (use median/trusted value)
        const rank = this.assertionService.getTrustedValue(assertions, 'rank');
        if (rank !== null) data.rank = rank;

        // Aggregate followers (use median/trusted value)
        const followers = this.assertionService.getTrustedValue(assertions, 'followers');
        if (followers !== null) data.followers = followers;

        // Aggregate zap amounts (use median/trusted value)
        const zapAmtRecd = this.assertionService.getTrustedValue(assertions, 'zapAmtRecd');
        if (zapAmtRecd !== null) data.zapAmtRecd = zapAmtRecd;

        const zapAmtSent = this.assertionService.getTrustedValue(assertions, 'zapAmtSent');
        if (zapAmtSent !== null) data.zapAmtSent = zapAmtSent;

        // Aggregate post count
        const postCnt = this.assertionService.getTrustedValue(assertions, 'postCnt');
        if (postCnt !== null) data.postCnt = postCnt;

        return data;
    }

    private applyContexts() {
        if (!this.jobContext || !this.serviceContext) return;

        this.earningsService.updateContext(
            this.jobContext.winningBidsOfUser,
            this.jobContext.winningBidAddressesOfUser,
            this.serviceContext.confirmOrders
        );
        this.paymentsService.updateContext(
            this.jobContext.winningBidsForUser,
            this.jobContext.winningBidAddressesForUser,
            this.serviceContext.ordersOfUser
        );
        this.pledgesService.updateContext(
            this.jobContext.involvedJobs,
            this.jobContext.involvedJobEvents,
            this.jobContext.involvedBids,
            this.serviceContext.involvedOrders,
            this.serviceContext.involvedServiceEvents,
            this.serviceContext.involvedOrderEvents
        );
    }

    private attachContextSubscriptions() {
        if (this.contextUnsubs.length > 0) return;

        this.contextUnsubs.push(
            this.jobBidService.subscribe((context) => {
                this.jobContext = context;
                this.applyContexts();
            })
        );

        this.contextUnsubs.push(
            this.serviceOrderService.subscribe((context) => {
                this.serviceContext = context;
                this.applyContexts();
            })
        );
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
            assertions: this.assertionData,
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
        this.jobBidService.destroy();
        this.serviceOrderService.destroy();
        this.contextUnsubs.forEach((unsub) => unsub());
        this.contextUnsubs = [];
    }
}
