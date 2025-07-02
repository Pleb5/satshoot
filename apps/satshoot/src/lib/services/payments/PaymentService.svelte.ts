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
        private targetEntity: JobEvent | ServiceEvent,
        private secondaryEntity: BidEvent | OrderEvent
    ) {}

    /**
     * Calculate payment shares based on current amounts
     */
    get paymentShares() {
        let sponsoredPercentage = 0;
        let satshootPercentage = 0;
        if (this.secondaryEntity instanceof BidEvent) {
            const bidEvent = this.secondaryEntity;
            sponsoredPercentage = bidEvent.sponsoredNpub ? Math.floor(bidEvent.pledgeSplit * bidEvent.sponsoringSplit / 100): 0;
        }
        satshootPercentage = this.secondaryEntity.pledgeSplit - sponsoredPercentage;

        const sponsoredShare = Math.floor(this.amount * sponsoredPercentage / 100); 
        const satshootShare = Math.floor(this.amount * satshootPercentage / 100);
        const freelancerShare = this.amount;

        return {
            satshootShare,
            freelancerShare,
            sponsoredShare
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

        costLabel = 'Price:';
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

        if (!this.targetEntity || !this.secondaryEntity) {
            return { isValid: false, error: 'Missing required entities' };
        }

        if (this.amount <= 0) {
            return { isValid: false, error: 'Amount must be greater than 0' };
        }

        return { isValid: true };
    }
}
