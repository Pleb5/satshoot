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
    pledgedAmount = $state(0);
    paying = $state(false);

    private pledgeSplit = 0;

    constructor(
        private targetEntity: JobEvent | ServiceEvent,
        private secondaryEntity: BidEvent | OrderEvent
    ) {
        if (this.secondaryEntity instanceof BidEvent) {
            this.pledgeSplit = this.secondaryEntity.pledgeSplit;
        } else if (this.targetEntity instanceof ServiceEvent) {
            this.pledgeSplit = this.targetEntity.pledgeSplit;
        }
    }

    /**
     * Calculate payment shares based on current amounts
     */
    get paymentShares() {
        const satshootShare = Math.floor((this.amount * this.pledgeSplit) / 100);
        const freelancerShare = this.amount - satshootShare;

        return {
            satshootShare,
            freelancerShare,
            totalSatshootAmount: satshootShare + this.pledgedAmount,
        };
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
            case Pricing.SatsPerMin:
                pricing = 'sats/min';
                break;
        }

        costLabel = this.secondaryEntity instanceof BidEvent ? 'Bid Cost:' : 'Service Cost:';
        amount = this.secondaryEntity.amount;

        return { pricing, costLabel, amount };
    }

    /**
     * Initialize payment and validate inputs
     */
    async initializePayment(): Promise<PaymentCalculation | null> {
        if (!this.targetEntity || !this.secondaryEntity) {
            this.paying = false;
            throw new Error('Could not find Job/Service or Bid/Order!');
        }

        this.paying = true;
        await tick();

        const { freelancerShare, totalSatshootAmount } = this.paymentShares;
        const freelancerShareMillisats = freelancerShare * 1000;
        const satshootSumMillisats = totalSatshootAmount * 1000;

        if (freelancerShareMillisats + satshootSumMillisats === 0) {
            this.paying = false;
            throw new Error('Cannot pay 0 sats!');
        }

        return { freelancerShareMillisats, satshootSumMillisats };
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

        if (!this.targetEntity || !this.secondaryEntity) {
            return { isValid: false, error: 'Missing required entities' };
        }

        if (this.amount <= 0) {
            return { isValid: false, error: 'Amount must be greater than 0' };
        }

        return { isValid: true };
    }
}
