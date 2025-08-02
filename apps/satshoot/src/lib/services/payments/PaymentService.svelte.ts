import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { OrderEvent } from '$lib/events/OrderEvent';
import { Pricing } from '$lib/events/types';
import currentUser from '$lib/stores/user';
import { get } from 'svelte/store';
import { tick } from 'svelte';

export interface PaymentCalculation {
    freelancerShareMillisats: number;
    satshootSumMillisats: number;
    sponsoredSumMillisats: number;
}

export interface PaymentData {
    pricing: string;
    costLabel: string;
    amount: number;
}

/**
 * Service for core payment operations and calculations
 */
export class PaymentService {
    // State
    amount = $state(0);
    satshootAmount = $state(0);
    sponsoredAmount = $state(0);
    paying = $state(false);

    constructor(
        private primaryEntity: JobEvent | ServiceEvent,
        private secondaryEntity: BidEvent | OrderEvent
    ) { }

    static computePaymentShares(
        amount: number,
        pledgeSplit: number,
        sponsoredNpub: string,
        sponsoringSplit: number) {

        const pledgeShare = Math.floor(amount * pledgeSplit / 100);
        const sponsoredShare = sponsoredNpub 
            ? Math.floor(pledgeShare * sponsoringSplit / 100)
            : 0;

        const satshootShare = pledgeShare - sponsoredShare;


        const freelancerShare = amount - pledgeShare;

        return {
            freelancerShare,
            satshootShare,
            sponsoredShare,
            pledgeShare
        };
    }

    /**
     * Calculate payment shares based on current amounts
     */
    get paymentShares() {
        if (this.secondaryEntity instanceof BidEvent) {
            return PaymentService.computePaymentShares(
                this.amount,
                this.secondaryEntity.pledgeSplit,
                this.secondaryEntity.sponsoredNpub,
                this.secondaryEntity.sponsoringSplit
            );
        } else if (this.primaryEntity instanceof ServiceEvent) {
            return PaymentService.computePaymentShares(
                this.amount,
                this.primaryEntity.pledgeSplit,
                this.primaryEntity.sponsoredNpub,
                this.primaryEntity.sponsoringSplit
            );
        } else {
            throw new Error("This is a bug, unexpected entity types!");
        }
    }

    /**
     * Get pricing information for the current entity
     */
    get pricingInfo(): PaymentData {
        let pricing = '';
        let costLabel = '';
        let amount = 0;

        switch (this.secondaryEntity.pricing) {
            case Pricing.Absolute:
                pricing = 'sats';
                break;
            case Pricing.Hourly:
                pricing = 'sats/hour';
                break;
        }

        costLabel = 'Price:';
        amount = this.secondaryEntity.amount;

        return { pricing, costLabel, amount };
    }

    /**
     * Initialize payment and validate inputs
     */
    async initializePayment(): Promise<PaymentCalculation | null> {
        if (!this.primaryEntity || !this.secondaryEntity) {
            this.paying = false;
            throw new Error('Could not find Job/Service or Bid/Order!');
        }

        this.paying = true;
        await tick();

        const freelancerShareMillisats = this.amount * 1000;
        const satshootSumMillisats = this.satshootAmount * 1000;
        const sponsoredSumMillisats = this.sponsoredAmount * 1000;

        if (freelancerShareMillisats + satshootSumMillisats + sponsoredSumMillisats === 0) {
            this.paying = false;
            throw new Error('Cannot pay 0 sats!');
        }

        return { freelancerShareMillisats, satshootSumMillisats, sponsoredSumMillisats };
    }

    /**
     * Reset payment state
     */
    resetPaymentState() {
        this.paying = false;
    }

    /**
     * Validate payment prerequisites
     */
    validatePayment(): { isValid: boolean; error?: string } {
        if (!get(currentUser)) {
            return { isValid: false, error: 'User not authenticated' };
        }

        if (!this.primaryEntity || !this.secondaryEntity) {
            return { isValid: false, error: 'Missing required entities' };
        }

        if (this.amount <= 0) {
            return { isValid: false, error: 'Amount must be greater than 0' };
        }

        return { isValid: true };
    }
}
