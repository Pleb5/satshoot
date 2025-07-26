import { PaymentService, type PaymentCalculation } from './PaymentService.svelte';
import { LightningPaymentService } from './LightningPaymentService.svelte';
import { CashuPaymentService } from './CashuPaymentService.svelte';
import { ToastService } from './ToastService.svelte';
import { createPaymentFilters, createPaymentStore, type PaymentStore } from '$lib/stores/payment';
import currentUser from '$lib/stores/user';
import { get } from 'svelte/store';
import type { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import type { OrderEvent } from '$lib/events/OrderEvent';
import { UserEnum } from './UserEnum';

/**
 * Main service that orchestrates all payment operations
 */
export class PaymentManagerService {
    private paymentService: PaymentService;
    private lightningService: LightningPaymentService;
    private cashuService: CashuPaymentService;
    private toastService: ToastService;

    private freelancerPaymentStore: PaymentStore | null = null;
    private satshootPaymentStore: PaymentStore | null = null;
    private sponsoredPaymentStore: PaymentStore | null = null;

    constructor(
        private primaryEntity: JobEvent | ServiceEvent,
        private secondaryEntity: BidEvent | OrderEvent
    ) {
        this.paymentService = new PaymentService(primaryEntity, secondaryEntity);
        this.lightningService = new LightningPaymentService(primaryEntity, secondaryEntity);
        this.cashuService = new CashuPaymentService(primaryEntity, secondaryEntity);
        this.toastService = new ToastService();

        this.initializePaymentStores();
    }

    /**
     * Initialize payment tracking stores
     */
    private initializePaymentStores() {
        if (this.secondaryEntity && get(currentUser)) {
            const freelancerFilters = createPaymentFilters(this.secondaryEntity, 'freelancer');
            const satshootFilters = createPaymentFilters(this.secondaryEntity, 'satshoot');

            this.freelancerPaymentStore = createPaymentStore(freelancerFilters);
            this.satshootPaymentStore = createPaymentStore(satshootFilters);

            this.freelancerPaymentStore.paymentStore.startSubscription();
            this.satshootPaymentStore.paymentStore.startSubscription();

            if (this.secondaryEntity instanceof BidEvent && !!this.secondaryEntity.sponsoredNpub || this.primaryEntity instanceof ServiceEvent && !!this.primaryEntity.sponsoredNpub) {
                const sponsoredFilters = createPaymentFilters(this.secondaryEntity, 'sponsored');
                this.sponsoredPaymentStore = createPaymentStore(sponsoredFilters);
                this.sponsoredPaymentStore.paymentStore.startSubscription();
            }
        }
    }

    /**
     * Get payment service for direct access to amounts and calculations
     */
    get payment() {
        return this.paymentService;
    }

    /**
     * Get Cashu service for UI state checks
     */
    get cashu() {
        return this.cashuService;
    }

    /**
     * Get freelancer payment tracking data
     */
    get freelancerPaid() {
        return this.freelancerPaymentStore?.totalPaid ?? null;
    }

    /**
     * Get satshoot payment tracking data
     */
    get satshootPaid() {
        return this.satshootPaymentStore?.totalPaid ?? null;
    }

    /**
     * Get sponsored npub payment tracking data
     */
    get sponsoredPaid() {
        return this.sponsoredPaymentStore?.totalPaid ?? null;
    }

    /**
     * Get pricing information
     */
    get pricingInfo() {
        return this.paymentService.pricingInfo;
    }

    setDefaultShare(userEnum: UserEnum) {
        switch (userEnum) {
            case UserEnum.Satshoot:
                this.payment.satshootAmount = this.payment.paymentShares.satshootShare;
                return;
            case UserEnum.Sponsored:
                this.payment.sponsoredAmount = this.payment.paymentShares.sponsoredShare;
                return;
            case UserEnum.Freelancer:
                return;
        }
    }

    /**
     * Process Lightning Network payment.
     * 
     * @payeeType if specified, the payment goes only to the given payee type. Otherwise all parties get paid.
     */
    async payWithLightning(payeeType: UserEnum | void): Promise<void> {
        try {
            const paymentData = await this.paymentService.initializePayment();
            if (!paymentData) return;

            let { freelancerShareMillisats, satshootSumMillisats, sponsoredSumMillisats } = paymentData;

            switch (payeeType) {
                case UserEnum.Freelancer:
                    satshootSumMillisats = 0;
                    sponsoredSumMillisats = 0;
                    break;
                case UserEnum.Satshoot:
                    freelancerShareMillisats = 0;
                    sponsoredSumMillisats = 0;
                    break;
                case UserEnum.Sponsored:
                    freelancerShareMillisats = 0;
                    satshootSumMillisats = 0;
            }

            const paid = await this.lightningService.processPayment(
                freelancerShareMillisats,
                satshootSumMillisats,
                sponsoredSumMillisats
            );

            this.handlePaymentResults(paid, freelancerShareMillisats, satshootSumMillisats, sponsoredSumMillisats);
        } catch (error: any) {
            console.error(error);
            this.toastService.handleGeneralError(`An error occurred in payment process: ${error}`);
        } finally {
            this.paymentService.resetPaymentState();
        }
    }

    /**
     * Process Cashu payment.
     * 
     * @payeeType if specified, the payment goes only to the given payee type. Otherwise all parties get paid.
     */
    async payWithCashu(payeeType: UserEnum | void): Promise<void> {
        try {
            const paymentData = await this.paymentService.initializePayment();
            if (!paymentData) return;

            let { freelancerShareMillisats, satshootSumMillisats } = paymentData;

            switch (payeeType) {
                case UserEnum.Freelancer:
                    satshootSumMillisats = 0;
                    break;
                case UserEnum.Satshoot:
                    freelancerShareMillisats = 0;
                    break;
            }

            const paid = await this.cashuService.processPayment(
                freelancerShareMillisats,
                satshootSumMillisats
            );

            this.handlePaymentResults(paid, freelancerShareMillisats, satshootSumMillisats, 0);
        } catch (error: any) {
            console.error(error);

            // Check if it's a payment error for specific user
            if (error.message?.includes('Freelancer')) {
                this.toastService.handlePaymentError(error, 'Freelancer');
            } else if (error.message?.includes('SatShoot')) {
                this.toastService.handlePaymentError(error, 'SatShoot');
            } else {
                this.toastService.handleGeneralError(error?.message || error);
            }
        } finally {
            this.paymentService.resetPaymentState();
        }
    }

    /**
     * Handle payment results and show appropriate notifications
     */
    private handlePaymentResults(
        paid: Map<UserEnum, boolean>,
        freelancerShareMillisats: number,
        satshootSumMillisats: number,
        sponsoredSumMillisats: number
    ) {
        if (freelancerShareMillisats) {
            this.toastService.handlePaymentStatus(
                paid,
                UserEnum.Freelancer,
                freelancerShareMillisats,
                'Freelancer Paid!',
                'Freelancer Payment might have failed!'
            );
        }

        if (satshootSumMillisats) {
            this.toastService.handlePaymentStatus(
                paid,
                UserEnum.Satshoot,
                satshootSumMillisats,
                'SatShoot Paid!',
                'SatShoot Payment might have failed!'
            );
        }

        if (sponsoredSumMillisats) {
            this.toastService.handlePaymentStatus(
                paid,
                UserEnum.Sponsored,
                sponsoredSumMillisats,
                'Sponsored Npub Paid!',
                'Sponsored Npub Payment might have failed!'
            );
        }
    }

    /**
     * Check if Cashu payment is available
     */
    get canPayWithCashu(): boolean {
        if (!this.cashu.hasSenderEcashSetup || !this.cashu.canPayWithEcash) {
            return false;
        }

        return this.cashu.checkMintBalance(this.paymentService.amount + this.paymentService.satshootAmount + this.paymentService.sponsoredAmount);
    }

    /**
     * Get Cashu tooltip text for UI
     */
    get cashuTooltipText(): string {
        if (!this.cashu.hasSenderEcashSetup) {
            return 'Setup Wallet to pay with Cashu!';
        }
        if (!this.cashu.canPayWithEcash) {
            return 'Could not find Freelancer Cashu Info';
        }
        if (!this.canPayWithCashu) {
            return 'No Mint in Wallet has enough balance for this amount!';
        }
        return '';
    }

    /**
     * Check if sender has ecash setup
     */
    get hasSenderEcashSetup(): boolean {
        return this.cashu.hasSenderEcashSetup;
    }

    /**
     * Validate current payment setup
     */
    validatePayment(): { isValid: boolean; error?: string } {
        return this.paymentService.validatePayment();
    }

    /**
     * Cleanup subscriptions
     */
    destroy() {
        if (this.freelancerPaymentStore) {
            this.freelancerPaymentStore.paymentStore.empty();
        }
        if (this.satshootPaymentStore) {
            this.satshootPaymentStore.paymentStore.empty();
        }
        if (this.sponsoredPaymentStore) {
            this.sponsoredPaymentStore.paymentStore.empty();
        }
    }
}
