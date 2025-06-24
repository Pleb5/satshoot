import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { EarningsService } from '../EarningsService.svelte';
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

describe('EarningsService', () => {
    const testUser: Hexpubkey = getPublicKey(generateSecretKey());
    let earningsService: EarningsService;
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
        if (earningsService) {
            earningsService.destroy();
        }
    });

    describe('Constructor', () => {
        it('should initialize with correct user and default earnings', () => {
            earningsService = new EarningsService(testUser);

            expect(earningsService.earnings).toBe(0);
            expect(earningsService.getEarnings()).toBe(0);
        });

        it('should create earnings filter with correct kinds', () => {
            earningsService = new EarningsService(testUser);

            expect(mockNDKInstance.storeSubscribe).toHaveBeenCalledWith(
                [
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
                }
            );
        });

        it('should setup store subscription', () => {
            earningsService = new EarningsService(testUser);

            expect(mockNDKStore.subscribe).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should calculate earnings when store updates', () => {
            const mockEvents = [
                { kind: NDKKind.Zap, signatureVerified: true } as NDKEvent,
                { kind: NDKKind.Nutzap, signatureVerified: true } as NDKEvent,
            ];
            (calculateTotalAmount as any).mockReturnValue(150);

            earningsService = new EarningsService(testUser);

            // Trigger the subscription callback
            mockSubscribeCallback(mockEvents);

            expect(calculateTotalAmount).toHaveBeenCalledWith(mockEvents);
            expect(earningsService.earnings).toBe(150);
        });
    });

    describe('initialize', () => {
        beforeEach(() => {
            earningsService = new EarningsService(testUser);
        });

        it('should update filter with user and winning bids', () => {
            const winningBids = ['bid1', 'bid2', 'bid3'];
            const confirmOrders = ['order1', 'order2'];

            earningsService.initialize(winningBids, confirmOrders);

            // Access the private earningsFilter through the instance
            const filterAccess = earningsService as any;

            expect(filterAccess.earningsFilter[0]['#p']).toEqual([testUser]);
            expect(filterAccess.earningsFilter[0]['#e']).toEqual(winningBids);
            expect(filterAccess.earningsFilter[1]['#p']).toEqual([testUser]);
            expect(filterAccess.earningsFilter[1]['#a']).toEqual(confirmOrders);
        });

        it('should start subscription after updating filters', () => {
            const winningBids = ['bid1'];
            const confirmOrders = ['order1'];

            earningsService.initialize(winningBids, confirmOrders);

            expect(mockNDKStore.startSubscription).toHaveBeenCalled();
        });

        it('should handle empty arrays', () => {
            earningsService.initialize([], []);

            const filterAccess = earningsService as any;

            expect(filterAccess.earningsFilter[0]['#p']).toEqual([testUser]);
            expect(filterAccess.earningsFilter[0]['#e']).toEqual([]);
            expect(filterAccess.earningsFilter[1]['#p']).toEqual([testUser]);
            expect(filterAccess.earningsFilter[1]['#a']).toEqual([]);
            expect(mockNDKStore.startSubscription).toHaveBeenCalled();
        });
    });

    describe('getEarnings', () => {
        it('should return current earnings value', () => {
            earningsService = new EarningsService(testUser);

            // Simulate earnings update
            (calculateTotalAmount as any).mockReturnValue(250);
            mockSubscribeCallback([]);

            expect(earningsService.getEarnings()).toBe(250);
        });

        it('should return reactive state value', () => {
            earningsService = new EarningsService(testUser);

            // Test initial state
            expect(earningsService.getEarnings()).toBe(0);

            // Simulate earnings change
            (calculateTotalAmount as any).mockReturnValue(500);
            mockSubscribeCallback([]);

            expect(earningsService.getEarnings()).toBe(500);
        });
    });

    describe('destroy', () => {
        it('should empty the earnings store', () => {
            earningsService = new EarningsService(testUser);

            earningsService.destroy();

            expect(mockNDKStore.empty).toHaveBeenCalled();
        });

        it('should handle missing store gracefully', () => {
            earningsService = new EarningsService(testUser);

            // Set store to null to simulate missing store
            (earningsService as any).earningsStore = null;

            expect(() => earningsService.destroy()).not.toThrow();
        });

        it('should be safe to call multiple times', () => {
            earningsService = new EarningsService(testUser);

            earningsService.destroy();
            earningsService.destroy();

            expect(mockNDKStore.empty).toHaveBeenCalledTimes(2);
        });
    });

    describe('Reactive State', () => {
        it('should update earnings reactively when events change', () => {
            const mockEvents1 = [{ kind: NDKKind.Zap } as NDKEvent];
            const mockEvents2 = [
                { kind: NDKKind.Zap } as NDKEvent,
                { kind: NDKKind.Nutzap } as NDKEvent,
            ];

            earningsService = new EarningsService(testUser);

            // First update
            (calculateTotalAmount as any).mockReturnValue(100);
            mockSubscribeCallback(mockEvents1);
            expect(earningsService.earnings).toBe(100);

            // Second update
            (calculateTotalAmount as any).mockReturnValue(250);
            mockSubscribeCallback(mockEvents2);
            expect(earningsService.earnings).toBe(250);
        });

        it('should handle zero earnings', () => {
            earningsService = new EarningsService(testUser);

            (calculateTotalAmount as any).mockReturnValue(0);
            mockSubscribeCallback([]);

            expect(earningsService.earnings).toBe(0);
            expect(earningsService.getEarnings()).toBe(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle calculateTotalAmount throwing error', () => {
            earningsService = new EarningsService(testUser);

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
                earningsService = new EarningsService(invalidUser);
            }).not.toThrow();

            expect((earningsService as any).user).toBe(invalidUser);
        });
    });

    describe('Integration Tests', () => {
        it('should work with full initialize and earnings cycle', () => {
            const winningBids = ['bid1', 'bid2'];
            const confirmOrders = ['order1'];
            const mockEvents = [
                { kind: NDKKind.Zap, signatureVerified: true } as NDKEvent,
                { kind: NDKKind.Nutzap, signatureVerified: true } as NDKEvent,
            ];

            earningsService = new EarningsService(testUser);
            earningsService.initialize(winningBids, confirmOrders);

            (calculateTotalAmount as any).mockReturnValue(350);
            mockSubscribeCallback(mockEvents);

            expect(earningsService.getEarnings()).toBe(350);
            expect(calculateTotalAmount).toHaveBeenCalledWith(mockEvents);
            expect(mockNDKStore.startSubscription).toHaveBeenCalled();
        });

        it('should maintain state consistency across operations', () => {
            earningsService = new EarningsService(testUser);

            // Initial state
            expect(earningsService.getEarnings()).toBe(0);

            // Initialize
            earningsService.initialize(['bid1'], ['order1']);
            expect(earningsService.getEarnings()).toBe(0);

            // Update earnings
            (calculateTotalAmount as any).mockReturnValue(200);
            mockSubscribeCallback([]);
            expect(earningsService.getEarnings()).toBe(200);

            // Destroy
            earningsService.destroy();
            expect(earningsService.getEarnings()).toBe(200); // State persists until new instance
        });
    });
});
