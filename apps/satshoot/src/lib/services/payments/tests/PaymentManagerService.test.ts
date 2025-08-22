import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentManagerService } from '../PaymentManagerService.svelte';
import { UserEnum } from '../UserEnum';
import type { JobEvent } from '$lib/events/JobEvent';
import type { BidEvent } from '$lib/events/BidEvent';
import type { ServiceEvent } from '$lib/events/ServiceEvent';
import type { OrderEvent } from '$lib/events/OrderEvent';
import { get } from 'svelte/store';

// Mock all dependencies
vi.mock('../PaymentService.svelte', () => ({
    PaymentService: vi.fn().mockImplementation(() => ({
        initializePayment: vi.fn(),
        resetPaymentState: vi.fn(),
        amount: 100000,
        satshootAmount: 10000,
        sponsoredAmount: 5000,
        paymentShares: {
            satshootShare: 10000,
            sponsoredShare: 5000
        },
        pricingInfo: {
            basePrice: 100000,
            satshootFee: 10000,
            sponsoredFee: 5000
        },
        validatePayment: vi.fn()
    }))
}));

vi.mock('../LightningPaymentService.svelte', () => ({
    LightningPaymentService: vi.fn().mockImplementation(() => ({
        processPayment: vi.fn()
    }))
}));

vi.mock('../CashuPaymentService.svelte', () => ({
    CashuPaymentService: vi.fn().mockImplementation(() => ({
        processPayment: vi.fn(),
        canPayWithEcash: vi.fn(),
        checkMintBalance: vi.fn(),
        hasSenderEcashSetup: true
    }))
}));

vi.mock('../ToastService.svelte', () => ({
    ToastService: vi.fn().mockImplementation(() => ({
        handlePaymentStatus: vi.fn(),
        handlePaymentError: vi.fn(),
        handleGeneralError: vi.fn()
    }))
}));

vi.mock('$lib/stores/payment', () => ({
    createPaymentFilters: vi.fn().mockReturnValue({}),
    createPaymentStore: vi.fn().mockReturnValue({
        paymentStore: {
            startSubscription: vi.fn(),
            empty: vi.fn()
        },
        totalPaid: 0
    })
}));

vi.mock('$lib/stores/user', () => ({
    default: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn()
    }
}));

vi.mock('$lib/stores/session', () => ({
    default: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock('svelte/store', () => ({
    get: vi.fn().mockReturnValue({ pubkey: 'test-user-pubkey' })
}));

describe('PaymentManagerService', () => {
    let service: PaymentManagerService;
    let mockPrimaryEntity: JobEvent;
    let mockSecondaryEntity: BidEvent;
    let mockPaymentService: any;
    let mockLightningService: any;
    let mockCashuService: any;
    let mockToastService: any;

    beforeEach(() => {
        // Create mock entities
        mockPrimaryEntity = {
            id: 'job-123',
            pubkey: 'job-owner-pubkey'
        } as unknown as JobEvent;

        mockSecondaryEntity = {
            id: 'bid-456',
            pubkey: 'bidder-pubkey',
            sponsoredNpub: null
        } as unknown as BidEvent;

        // Create service instance
        service = new PaymentManagerService(mockPrimaryEntity, mockSecondaryEntity);

        // Get references to mocked services
        mockPaymentService = (service as any).paymentService;
        mockLightningService = (service as any).lightningService;
        mockCashuService = (service as any).cashuService;
        mockToastService = (service as any).toastService;
    });

    afterEach(() => {
        vi.clearAllMocks();
        service.destroy();
    });

    describe('payWithLightning', () => {
        const mockPaymentData = {
            freelancerShareMillisats: 100000,
            satshootSumMillisats: 10000,
            sponsoredSumMillisats: 5000
        };

        beforeEach(() => {
            mockPaymentService.initializePayment.mockResolvedValue(mockPaymentData);
        });

        it('should process payment for all payees when no payeeType specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, true],
                [UserEnum.Satshoot, true],
                [UserEnum.Sponsored, true]
            ]);
            mockLightningService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithLightning();

            // Verify
            expect(mockPaymentService.initializePayment).toHaveBeenCalledOnce();
            expect(mockLightningService.processPayment).toHaveBeenCalledWith(
                100000, // freelancerShareMillisats
                10000,  // satshootSumMillisats
                5000    // sponsoredSumMillisats
            );
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();

            // Verify toast notifications for successful payments
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(3);
        });

        it('should only pay freelancer when UserEnum.Freelancer specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, true]
            ]);
            mockLightningService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithLightning(UserEnum.Freelancer);

            // Verify - only freelancer amount should be paid
            expect(mockLightningService.processPayment).toHaveBeenCalledWith(
                100000, // freelancerShareMillisats
                0,      // satshootSumMillisats (zeroed)
                0       // sponsoredSumMillisats (zeroed)
            );

            // Only freelancer toast should be shown
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(1);
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledWith(
                paymentMap,
                UserEnum.Freelancer,
                100000,
                'Freelancer Paid!',
                'Freelancer Payment might have failed!'
            );
        });

        it('should only pay satshoot when UserEnum.Satshoot specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Satshoot, true]
            ]);
            mockLightningService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithLightning(UserEnum.Satshoot);

            // Verify - only satshoot amount should be paid
            expect(mockLightningService.processPayment).toHaveBeenCalledWith(
                0,      // freelancerShareMillisats (zeroed)
                10000,  // satshootSumMillisats
                0       // sponsoredSumMillisats (zeroed)
            );

            // Only satshoot toast should be shown
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(1);
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledWith(
                paymentMap,
                UserEnum.Satshoot,
                10000,
                'SatShoot Paid!',
                'SatShoot Payment might have failed!'
            );
        });

        it('should only pay sponsored when UserEnum.Sponsored specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Sponsored, true]
            ]);
            mockLightningService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithLightning(UserEnum.Sponsored);

            // Verify - only sponsored amount should be paid
            expect(mockLightningService.processPayment).toHaveBeenCalledWith(
                0,     // freelancerShareMillisats (zeroed)
                0,     // satshootSumMillisats (zeroed)
                5000   // sponsoredSumMillisats
            );

            // Only sponsored toast should be shown
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(1);
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledWith(
                paymentMap,
                UserEnum.Sponsored,
                5000,
                'Sponsored Npub Paid!',
                'Sponsored Npub Payment might have failed!'
            );
        });

        it('should handle payment failure gracefully', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, false],
                [UserEnum.Satshoot, true],
                [UserEnum.Sponsored, false]
            ]);
            mockLightningService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithLightning();

            // Verify - all payments attempted
            expect(mockLightningService.processPayment).toHaveBeenCalledWith(
                100000, 10000, 5000
            );

            // Toast service should be called for all payments with appropriate status
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(3);
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should return early if initializePayment returns null', async () => {
            // Setup
            mockPaymentService.initializePayment.mockResolvedValue(null);

            // Execute
            await service.payWithLightning();

            // Verify - no payment processing should occur
            expect(mockLightningService.processPayment).not.toHaveBeenCalled();
            expect(mockToastService.handlePaymentStatus).not.toHaveBeenCalled();
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should return early if initializePayment returns zero amounts for all payees', async () => {
            // Setup
            mockPaymentService.initializePayment.mockResolvedValue({
                freelancerShareMillisats: 0,
                satshootSumMillisats: 0,
                sponsoredSumMillisats: 0
            });

            // Execute
            await service.payWithLightning();

            // Verify - no payment processing should occur
            expect(mockLightningService.processPayment).not.toHaveBeenCalled();
            expect(mockToastService.handlePaymentStatus).not.toHaveBeenCalled();
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should handle errors and show general error toast', async () => {
            // Setup
            const error = new Error('Lightning payment failed');
            mockLightningService.processPayment.mockRejectedValue(error);

            // Execute
            await service.payWithLightning();

            // Verify error handling
            expect(mockToastService.handleGeneralError).toHaveBeenCalledWith(
                'An error occurred in payment process: Error: Lightning payment failed'
            );
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should reset payment state even when error occurs', async () => {
            // Setup
            mockLightningService.processPayment.mockRejectedValue(new Error('Payment failed'));

            // Execute
            await service.payWithLightning();

            // Verify reset is called
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });
    });

    describe('payWithCashu', () => {
        const mockPaymentData = {
            freelancerShareMillisats: 100000,
            satshootSumMillisats: 10000,
            sponsoredSumMillisats: 5000
        };

        beforeEach(() => {
            mockPaymentService.initializePayment.mockResolvedValue(mockPaymentData);
        });

        it('should process payment for all payees when no payeeType specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, true],
                [UserEnum.Satshoot, true],
                [UserEnum.Sponsored, true]
            ]);
            mockCashuService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithCashu();

            // Verify
            expect(mockPaymentService.initializePayment).toHaveBeenCalledOnce();
            expect(mockCashuService.processPayment).toHaveBeenCalledWith(
                100000, // freelancerShareMillisats
                10000,  // satshootSumMillisats
                5000    // sponsoredSumMillisats
            );
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();

            // Verify toast notifications
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(3);
        });

        it('should only pay freelancer when UserEnum.Freelancer specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, true]
            ]);
            mockCashuService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithCashu(UserEnum.Freelancer);

            // Verify
            expect(mockCashuService.processPayment).toHaveBeenCalledWith(
                100000, // freelancerShareMillisats
                0,      // satshootSumMillisats (zeroed)
                0       // sponsoredSumMillisats (zeroed)
            );

            // Only freelancer toast should be shown
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(1);
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledWith(
                paymentMap,
                UserEnum.Freelancer,
                100000,
                'Freelancer Paid!',
                'Freelancer Payment might have failed!'
            );
        });

        it('should only pay satshoot when UserEnum.Satshoot specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Satshoot, true]
            ]);
            mockCashuService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithCashu(UserEnum.Satshoot);

            // Verify
            expect(mockCashuService.processPayment).toHaveBeenCalledWith(
                0,      // freelancerShareMillisats (zeroed)
                10000,  // satshootSumMillisats
                0       // sponsoredSumMillisats (zeroed)
            );

            // Only satshoot toast should be shown
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(1);
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledWith(
                paymentMap,
                UserEnum.Satshoot,
                10000,
                'SatShoot Paid!',
                'SatShoot Payment might have failed!'
            );
        });

        it('should only pay sponsored when UserEnum.Sponsored specified', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Sponsored, true]
            ]);
            mockCashuService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithCashu(UserEnum.Sponsored);

            // Verify
            expect(mockCashuService.processPayment).toHaveBeenCalledWith(
                0,     // freelancerShareMillisats (zeroed)
                0,     // satshootSumMillisats (zeroed)
                5000   // sponsoredSumMillisats
            );

            // Only sponsored toast should be shown
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(1);
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledWith(
                paymentMap,
                UserEnum.Sponsored,
                5000,
                'Sponsored Npub Paid!',
                'Sponsored Npub Payment might have failed!'
            );
        });

        it('should handle Freelancer-specific payment error', async () => {
            // Setup
            const error = new Error('Freelancer payment failed');
            mockCashuService.processPayment.mockRejectedValue(error);

            // Execute
            await service.payWithCashu();

            // Verify
            expect(mockToastService.handlePaymentError).toHaveBeenCalledWith(error, 'Freelancer');
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should handle SatShoot-specific payment error', async () => {
            // Setup
            const error = new Error('SatShoot payment failed');
            mockCashuService.processPayment.mockRejectedValue(error);

            // Execute
            await service.payWithCashu();

            // Verify
            expect(mockToastService.handlePaymentError).toHaveBeenCalledWith(error, 'SatShoot');
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should handle Sponsored-specific payment error', async () => {
            // Setup
            const error = new Error('Sponsored payment failed');
            mockCashuService.processPayment.mockRejectedValue(error);

            // Execute
            await service.payWithCashu();

            // Verify
            expect(mockToastService.handlePaymentError).toHaveBeenCalledWith(error, 'Sponsored npub');
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should handle general error when no specific user mentioned', async () => {
            // Setup
            const error = new Error('Generic payment error');
            mockCashuService.processPayment.mockRejectedValue(error);

            // Execute
            await service.payWithCashu();

            // Verify
            expect(mockToastService.handleGeneralError).toHaveBeenCalledWith('Generic payment error');
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should handle error object without message property', async () => {
            // Setup
            const error = 'String error';
            mockCashuService.processPayment.mockRejectedValue(error);

            // Execute
            await service.payWithCashu();

            // Verify
            expect(mockToastService.handleGeneralError).toHaveBeenCalledWith('String error');
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should return early if initializePayment returns null', async () => {
            // Setup
            mockPaymentService.initializePayment.mockResolvedValue(null);

            // Execute
            await service.payWithCashu();

            // Verify
            expect(mockCashuService.processPayment).not.toHaveBeenCalled();
            expect(mockToastService.handlePaymentStatus).not.toHaveBeenCalled();
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should reset payment state even when error occurs', async () => {
            // Setup
            mockCashuService.processPayment.mockRejectedValue(new Error('Payment failed'));

            // Execute
            await service.payWithCashu();

            // Verify reset is called
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });

        it('should handle partial payment failures', async () => {
            // Setup
            const paymentMap = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, true],
                [UserEnum.Satshoot, false],
                [UserEnum.Sponsored, true]
            ]);
            mockCashuService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithCashu();

            // Verify all payments attempted
            expect(mockCashuService.processPayment).toHaveBeenCalledWith(
                100000, 10000, 5000
            );

            // Toast service should handle mixed results
            expect(mockToastService.handlePaymentStatus).toHaveBeenCalledTimes(3);
            expect(mockPaymentService.resetPaymentState).toHaveBeenCalledOnce();
        });
    });

    describe('Edge cases and integration', () => {
        it('should handle zero amounts gracefully', async () => {
            // Setup
            const mockPaymentData = {
                freelancerShareMillisats: 0,
                satshootSumMillisats: 0,
                sponsoredSumMillisats: 0
            };
            mockPaymentService.initializePayment.mockResolvedValue(mockPaymentData);

            const paymentMap = new Map<UserEnum, boolean>();
            mockLightningService.processPayment.mockResolvedValue(paymentMap);

            // Execute
            await service.payWithLightning();

            // Verify - processPayment called with zeros
            expect(mockLightningService.processPayment).not.toHaveBeenCalledWith(0, 0, 0);

            // No toast notifications should be shown for zero amounts
            expect(mockToastService.handlePaymentStatus).not.toHaveBeenCalled();
        });

        it('should properly clean up resources on destroy', () => {
            // Setup - create service with stores
            const mockStoreEmpty = vi.fn();
            const mockStore = {
                paymentStore: {
                    startSubscription: vi.fn(),
                    empty: mockStoreEmpty
                },
                totalPaid: 0
            };

            vi.mocked((service as any).freelancerPaymentStore = mockStore);
            vi.mocked((service as any).satshootPaymentStore = mockStore);
            vi.mocked((service as any).sponsoredPaymentStore = mockStore);

            // Execute
            service.destroy();

            // Verify cleanup
            expect(mockStoreEmpty).toHaveBeenCalledTimes(3);
        });
    });
});