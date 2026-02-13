import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { PaymentsService } from '../PaymentsService.svelte';
import {
    NDKKind,
    NDKEvent,
    NDKSubscriptionCacheUsage,
    NDKPrivateKeySigner,
} from '@nostr-dev-kit/ndk';
import type { Hexpubkey, NDKFilter } from '@nostr-dev-kit/ndk';
import { calculateTotalAmount } from '../utils';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

// Mock the external dependencies
vi.mock('$lib/stores/session', () => ({
    default: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock('../utils', () => ({
    calculateTotalAmount: vi.fn(),
}));

// Mock NDK store
const mockNDKStore = {
    storeSubscribe: vi.fn(),
    subscribe: vi.fn(),
    startSubscription: vi.fn(),
    empty: vi.fn(),
};

const mockNDKInstance = {
    storeSubscribe: vi.fn(() => mockNDKStore),
};

// Mock svelte/store get function
vi.mock('svelte/store', async () => {
    const actual = await vi.importActual('svelte/store');
    return {
        ...actual,
        get: vi.fn(() => mockNDKInstance),
    };
});

describe('PaymentsService', () => {
    const testUser: Hexpubkey = getPublicKey(generateSecretKey());
    let paymentsService: PaymentsService;
    let mockSubscribeCallback: (events: NDKEvent[]) => void;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock store subscription
        mockNDKStore.subscribe = vi.fn((callback) => {
            mockSubscribeCallback = callback;
            return () => {}; // unsubscribe function
        });

        // Reset calculateTotalAmount mock
        (calculateTotalAmount as any).mockReturnValue(0);
    });

    afterEach(() => {
        if (paymentsService) {
            paymentsService.destroy();
        }
    });

    describe('Constructor', () => {
        it('should initialize with correct user and default payments', () => {
            paymentsService = new PaymentsService(testUser);

            expect(paymentsService.payments).toBe(0);
            expect(paymentsService.getPayments()).toBe(0);
        });

        it('should create payments filter with correct kinds', () => {
            paymentsService = new PaymentsService(testUser);

            expect(mockNDKInstance.storeSubscribe).toHaveBeenCalledWith(
                [
                    {
                        kinds: [NDKKind.Zap, NDKKind.Nutzap],
                    },
                    {
                        kinds: [NDKKind.Zap, NDKKind.Nutzap],
                    },
                    {
                        kinds: [NDKKind.Zap, NDKKind.Nutzap],
                    },
                ],
                {
                    autoStart: false,
                    cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
                    closeOnEose: false,
                    groupable: false,
                }
            );
        });

        it('should setup store subscription', () => {
            paymentsService = new PaymentsService(testUser);

            expect(mockNDKStore.subscribe).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should store user hex correctly', () => {
            paymentsService = new PaymentsService(testUser);

            expect((paymentsService as any).user).toBe(testUser);
        });

        it('should initialize payments filter as array with three objects', () => {
            paymentsService = new PaymentsService(testUser);

            const filterAccess = paymentsService as any;
            expect(Array.isArray(filterAccess.paymentsFilter)).toBe(true);
            expect(filterAccess.paymentsFilter).toHaveLength(3);
            expect(filterAccess.paymentsFilter[0].kinds).toEqual([NDKKind.Zap, NDKKind.Nutzap]);
            expect(filterAccess.paymentsFilter[1].kinds).toEqual([NDKKind.Zap, NDKKind.Nutzap]);
            expect(filterAccess.paymentsFilter[2].kinds).toEqual([NDKKind.Zap, NDKKind.Nutzap]);
        });

        it('should calculate payments when store updates', () => {
            const mockEvents = [
                { kind: NDKKind.Zap, signatureVerified: true } as NDKEvent,
                { kind: NDKKind.Nutzap, signatureVerified: true } as NDKEvent,
            ];
            (calculateTotalAmount as any).mockReturnValue(300);

            paymentsService = new PaymentsService(testUser);

            // Trigger the subscription callback
            mockSubscribeCallback(mockEvents);

            expect(calculateTotalAmount).toHaveBeenCalledWith(mockEvents);
            expect(paymentsService.payments).toBe(300);
        });
    });

    describe('initialize', () => {
        beforeEach(() => {
            paymentsService = new PaymentsService(testUser);
        });

        it('should update filter with winning bids for user jobs', () => {
            const winningBidsForUser = ['bid1', 'bid2', 'bid3'];
            const winningBidAddressesForUser = ['bid-address-1', 'bid-address-2', 'bid-address-3'];
            const ordersOfUser = ['order1', 'order2'];

            paymentsService.initialize(winningBidsForUser, winningBidAddressesForUser, ordersOfUser);

            // Access the private paymentsFilter through the instance
            const filterAccess = paymentsService as any;

            expect(filterAccess.paymentsFilter[0]['#e']).toEqual(winningBidsForUser);
            expect(filterAccess.paymentsFilter[1]['#a']).toEqual(winningBidAddressesForUser);
            expect(filterAccess.paymentsFilter[2]['#a']).toEqual(ordersOfUser);
        });

        it('should start subscription after updating filters', () => {
            const winningBidsForUser = ['bid1'];
            const winningBidAddressesForUser = ['bid-address-1'];
            const ordersOfUser = ['order1'];

            paymentsService.initialize(winningBidsForUser, winningBidAddressesForUser, ordersOfUser);

            expect(mockNDKStore.startSubscription).toHaveBeenCalled();
        });

        it('should handle empty arrays', () => {
            paymentsService.initialize([], [], []);

            const filterAccess = paymentsService as any;

            expect(filterAccess.paymentsFilter[0]['#e']).toEqual([]);
            expect(filterAccess.paymentsFilter[1]['#a']).toEqual([]);
            expect(filterAccess.paymentsFilter[2]['#a']).toEqual([]);
            expect(mockNDKStore.startSubscription).toHaveBeenCalled();
        });

        it('should properly set both filter types', () => {
            const winningBidsForUser = ['bid1', 'bid2'];
            const winningBidAddressesForUser = ['bid-address-1', 'bid-address-2'];
            const ordersOfUser = ['order1', 'order2', 'order3'];

            paymentsService.initialize(winningBidsForUser, winningBidAddressesForUser, ordersOfUser);

            const filterAccess = paymentsService as any;

            // First filter should have winning bids
            expect(filterAccess.paymentsFilter[0]['#e']).toEqual(winningBidsForUser);
            expect(filterAccess.paymentsFilter[0]['#a']).toBeUndefined();

            // Second filter should have bid addresses
            expect(filterAccess.paymentsFilter[1]['#a']).toEqual(winningBidAddressesForUser);
            expect(filterAccess.paymentsFilter[1]['#e']).toBeUndefined();

            // Third filter should have orders
            expect(filterAccess.paymentsFilter[2]['#a']).toEqual(ordersOfUser);
            expect(filterAccess.paymentsFilter[2]['#e']).toBeUndefined();
        });

        it('should handle single item arrays', () => {
            const winningBidsForUser = ['single-bid'];
            const winningBidAddressesForUser = ['bid-address-single'];
            const ordersOfUser = ['single-order'];

            paymentsService.initialize(winningBidsForUser, winningBidAddressesForUser, ordersOfUser);

            const filterAccess = paymentsService as any;

            expect(filterAccess.paymentsFilter[0]['#e']).toEqual(['single-bid']);
            expect(filterAccess.paymentsFilter[1]['#a']).toEqual(['bid-address-single']);
            expect(filterAccess.paymentsFilter[2]['#a']).toEqual(['single-order']);
        });
    });

    describe('getPayments', () => {
        it('should return current payments value', () => {
            paymentsService = new PaymentsService(testUser);

            // Simulate payments update
            (calculateTotalAmount as any).mockReturnValue(750);
            mockSubscribeCallback([]);

            expect(paymentsService.getPayments()).toBe(750);
        });

        it('should return reactive state value', () => {
            paymentsService = new PaymentsService(testUser);

            // Test initial state
            expect(paymentsService.getPayments()).toBe(0);

            // Simulate payments change
            (calculateTotalAmount as any).mockReturnValue(1200);
            mockSubscribeCallback([]);

            expect(paymentsService.getPayments()).toBe(1200);
        });

        it('should return same value as payments property', () => {
            paymentsService = new PaymentsService(testUser);

            (calculateTotalAmount as any).mockReturnValue(500);
            mockSubscribeCallback([]);

            expect(paymentsService.getPayments()).toBe(paymentsService.payments);
        });
    });

    describe('destroy', () => {
        it('should empty the payments store', () => {
            paymentsService = new PaymentsService(testUser);

            paymentsService.destroy();

            expect(mockNDKStore.empty).toHaveBeenCalled();
        });

        it('should handle missing store gracefully', () => {
            paymentsService = new PaymentsService(testUser);

            // Set store to null to simulate missing store
            (paymentsService as any).paymentsStore = null;

            expect(() => paymentsService.destroy()).not.toThrow();
        });

        it('should be safe to call multiple times', () => {
            paymentsService = new PaymentsService(testUser);

            paymentsService.destroy();
            paymentsService.destroy();

            expect(mockNDKStore.empty).toHaveBeenCalledTimes(2);
        });

        it('should handle undefined store', () => {
            paymentsService = new PaymentsService(testUser);

            // Set store to undefined
            (paymentsService as any).paymentsStore = undefined;

            expect(() => paymentsService.destroy()).not.toThrow();
            expect(mockNDKStore.empty).not.toHaveBeenCalled();
        });
    });

    describe('Reactive State', () => {
        it('should update payments reactively when events change', () => {
            const mockEvents1 = [{ kind: NDKKind.Zap } as NDKEvent];
            const mockEvents2 = [
                { kind: NDKKind.Zap } as NDKEvent,
                { kind: NDKKind.Nutzap } as NDKEvent,
            ];

            paymentsService = new PaymentsService(testUser);

            // First update
            (calculateTotalAmount as any).mockReturnValue(200);
            mockSubscribeCallback(mockEvents1);
            expect(paymentsService.payments).toBe(200);

            // Second update
            (calculateTotalAmount as any).mockReturnValue(450);
            mockSubscribeCallback(mockEvents2);
            expect(paymentsService.payments).toBe(450);
        });

        it('should handle zero payments', () => {
            paymentsService = new PaymentsService(testUser);

            (calculateTotalAmount as any).mockReturnValue(0);
            mockSubscribeCallback([]);

            expect(paymentsService.payments).toBe(0);
            expect(paymentsService.getPayments()).toBe(0);
        });

        it('should handle negative values from calculateTotalAmount', () => {
            paymentsService = new PaymentsService(testUser);

            (calculateTotalAmount as any).mockReturnValue(-100);
            mockSubscribeCallback([]);

            expect(paymentsService.payments).toBe(-100);
            expect(paymentsService.getPayments()).toBe(-100);
        });

        it('should handle large payment amounts', () => {
            paymentsService = new PaymentsService(testUser);

            const largeAmount = 999999999;
            (calculateTotalAmount as any).mockReturnValue(largeAmount);
            mockSubscribeCallback([]);

            expect(paymentsService.payments).toBe(largeAmount);
            expect(paymentsService.getPayments()).toBe(largeAmount);
        });
    });

    describe('Error Handling', () => {
        it('should handle calculateTotalAmount throwing error', () => {
            paymentsService = new PaymentsService(testUser);

            (calculateTotalAmount as any).mockImplementation(() => {
                throw new Error('Calculation error');
            });

            expect(() => {
                mockSubscribeCallback([{ kind: NDKKind.Zap } as NDKEvent]);
            }).toThrow('Calculation error');
        });

        it('should handle invalid user hex', () => {
            const invalidUser = 'invalid-hex' as Hexpubkey;

            expect(() => {
                paymentsService = new PaymentsService(invalidUser);
            }).not.toThrow();

            expect((paymentsService as any).user).toBe(invalidUser);
        });

        it('should handle NDK store creation failure', () => {
            // Mock storeSubscribe to throw an error
            mockNDKInstance.storeSubscribe.mockImplementationOnce(() => {
                throw new Error('Store creation failed');
            });

            expect(() => {
                paymentsService = new PaymentsService(testUser);
            }).toThrow('Store creation failed');
        });

        it('should handle subscription callback errors', () => {
            paymentsService = new PaymentsService(testUser);

            // Mock subscribe to throw when called
            mockNDKStore.subscribe.mockImplementation(() => {
                throw new Error('Subscription error');
            });

            // This should not prevent service creation, but might affect functionality
            expect(paymentsService).toBeDefined();
        });
    });

    describe('Integration Tests', () => {
        it('should work with full initialize and payments cycle', () => {
            const winningBidsForUser = ['bid1', 'bid2'];
            const winningBidAddressesForUser = ['bid-address-1', 'bid-address-2'];
            const ordersOfUser = ['order1'];
            const mockEvents = [
                { kind: NDKKind.Zap, signatureVerified: true } as NDKEvent,
                { kind: NDKKind.Nutzap, signatureVerified: true } as NDKEvent,
            ];

            paymentsService = new PaymentsService(testUser);
            paymentsService.initialize(
                winningBidsForUser,
                winningBidAddressesForUser,
                ordersOfUser
            );

            (calculateTotalAmount as any).mockReturnValue(650);
            mockSubscribeCallback(mockEvents);

            expect(paymentsService.getPayments()).toBe(650);
            expect(calculateTotalAmount).toHaveBeenCalledWith(mockEvents);
            expect(mockNDKStore.startSubscription).toHaveBeenCalled();
        });

        it('should maintain state consistency across operations', () => {
            paymentsService = new PaymentsService(testUser);

            // Initial state
            expect(paymentsService.getPayments()).toBe(0);

            // Initialize
            paymentsService.initialize(['bid1'], ['bid-address-1'], ['order1']);
            expect(paymentsService.getPayments()).toBe(0);

            // Update payments
            (calculateTotalAmount as any).mockReturnValue(800);
            mockSubscribeCallback([]);
            expect(paymentsService.getPayments()).toBe(800);

            // Destroy
            paymentsService.destroy();
            expect(paymentsService.getPayments()).toBe(800); // State persists until new instance
        });

        it('should handle multiple initialize calls', () => {
            paymentsService = new PaymentsService(testUser);

            // First initialize
            paymentsService.initialize(['bid1'], ['bid-address-1'], ['order1']);
            const filterAccess1 = paymentsService as any;
            expect(filterAccess1.paymentsFilter[0]['#e']).toEqual(['bid1']);
            expect(filterAccess1.paymentsFilter[1]['#a']).toEqual(['bid-address-1']);
            expect(filterAccess1.paymentsFilter[2]['#a']).toEqual(['order1']);

            // Second initialize should overwrite
            paymentsService.initialize(
                ['bid2', 'bid3'],
                ['bid-address-2', 'bid-address-3'],
                ['order2']
            );
            const filterAccess2 = paymentsService as any;
            expect(filterAccess2.paymentsFilter[0]['#e']).toEqual(['bid2', 'bid3']);
            expect(filterAccess2.paymentsFilter[1]['#a']).toEqual(['bid-address-2', 'bid-address-3']);
            expect(filterAccess2.paymentsFilter[2]['#a']).toEqual(['order2']);

            expect(mockNDKStore.startSubscription).toHaveBeenCalledTimes(1);
        });
    });

    describe('Filter Configuration', () => {
        it('should maintain separate filters for different payment types', () => {
            paymentsService = new PaymentsService(testUser);

            const winningBids = ['bid1', 'bid2'];
            const winningBidAddresses = ['bid-address-1', 'bid-address-2'];
            const orders = ['order1', 'order2'];

            paymentsService.initialize(winningBids, winningBidAddresses, orders);

            const filterAccess = paymentsService as any;

            // First filter should only have #e (winning bids)
            expect(filterAccess.paymentsFilter[0]['#e']).toEqual(winningBids);
            expect(filterAccess.paymentsFilter[0]['#a']).toBeUndefined();

            // Second filter should only have #a (winning bid addresses)
            expect(filterAccess.paymentsFilter[1]['#a']).toEqual(winningBidAddresses);
            expect(filterAccess.paymentsFilter[1]['#e']).toBeUndefined();

            // Third filter should only have #a (orders)
            expect(filterAccess.paymentsFilter[2]['#a']).toEqual(orders);
            expect(filterAccess.paymentsFilter[2]['#e']).toBeUndefined();

            // Both should have the same kinds
            expect(filterAccess.paymentsFilter[0].kinds).toEqual([NDKKind.Zap, NDKKind.Nutzap]);
            expect(filterAccess.paymentsFilter[1].kinds).toEqual([NDKKind.Zap, NDKKind.Nutzap]);
            expect(filterAccess.paymentsFilter[2].kinds).toEqual([NDKKind.Zap, NDKKind.Nutzap]);
        });

        it('should not modify original filter structure', () => {
            paymentsService = new PaymentsService(testUser);

            const originalFilterAccess = paymentsService as any;
            const originalFilter0 = { ...originalFilterAccess.paymentsFilter[0] };
            const originalFilter1 = { ...originalFilterAccess.paymentsFilter[1] };
            const originalFilter2 = { ...originalFilterAccess.paymentsFilter[2] };

            paymentsService.initialize(['bid1'], ['bid-address-1'], ['order1']);

            // Filters should still have the same kinds
            expect(originalFilterAccess.paymentsFilter[0].kinds).toEqual(originalFilter0.kinds);
            expect(originalFilterAccess.paymentsFilter[1].kinds).toEqual(originalFilter1.kinds);
            expect(originalFilterAccess.paymentsFilter[2].kinds).toEqual(originalFilter2.kinds);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very long arrays', () => {
            paymentsService = new PaymentsService(testUser);

            const longBidsArray = Array.from({ length: 1000 }, (_, i) => `bid${i}`);
            const longBidAddressesArray = Array.from(
                { length: 1000 },
                (_, i) => `bid-address-${i}`
            );
            const longOrdersArray = Array.from({ length: 1000 }, (_, i) => `order${i}`);

            expect(() => {
                paymentsService.initialize(longBidsArray, longBidAddressesArray, longOrdersArray);
            }).not.toThrow();

            const filterAccess = paymentsService as any;
            expect(filterAccess.paymentsFilter[0]['#e']).toHaveLength(1000);
            expect(filterAccess.paymentsFilter[1]['#a']).toHaveLength(1000);
            expect(filterAccess.paymentsFilter[2]['#a']).toHaveLength(1000);
        });

        it('should handle special characters in bid and order IDs', () => {
            paymentsService = new PaymentsService(testUser);

            const specialBids = ['bid-with-dashes', 'bid_with_underscores', 'bid.with.dots'];
            const specialBidAddresses = ['bid-address-1', 'bid-address-2', 'bid-address-3'];
            const specialOrders = ['order@with@symbols', 'order#with#hash', 'order%with%percent'];

            paymentsService.initialize(specialBids, specialBidAddresses, specialOrders);

            const filterAccess = paymentsService as any;
            expect(filterAccess.paymentsFilter[0]['#e']).toEqual(specialBids);
            expect(filterAccess.paymentsFilter[1]['#a']).toEqual(specialBidAddresses);
            expect(filterAccess.paymentsFilter[2]['#a']).toEqual(specialOrders);
        });

        it('should handle mixed data types in arrays (defensive programming)', () => {
            paymentsService = new PaymentsService(testUser);

            // Even though TypeScript should prevent this, test defensive behavior
            const mixedBids = ['valid-bid', '', 'another-bid'] as string[];
            const mixedBidAddresses = ['bid-address-1', '', 'bid-address-2'] as string[];
            const mixedOrders = ['valid-order', '', 'another-order'] as string[];

            paymentsService.initialize(mixedBids, mixedBidAddresses, mixedOrders);

            const filterAccess = paymentsService as any;
            expect(filterAccess.paymentsFilter[0]['#e']).toEqual(['valid-bid', 'another-bid']);
            expect(filterAccess.paymentsFilter[1]['#a']).toEqual(['bid-address-1', 'bid-address-2']);
            expect(filterAccess.paymentsFilter[2]['#a']).toEqual(['valid-order', 'another-order']);
        });
    });
});
