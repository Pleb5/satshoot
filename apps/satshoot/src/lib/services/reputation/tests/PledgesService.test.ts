import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PledgesService } from '../PledgesService.svelte';
import {
    NDKKind,
    zapInvoiceFromEvent,
    NDKNutzap,
    type NDKEvent,
    type Hexpubkey,
} from '@nostr-dev-kit/ndk';
import { get } from 'svelte/store';
import { SatShootPubkey } from '$lib/utils/misc';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import type { JobEvent } from '$lib/events/JobEvent';
import type { BidEvent } from '$lib/events/BidEvent';
import type { ServiceEvent } from '$lib/events/ServiceEvent';
import type { OrderEvent } from '$lib/events/OrderEvent';

// Mock the external dependencies
vi.mock('$lib/stores/session', () => ({
    default: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
    },
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

vi.mock('@nostr-dev-kit/ndk', async () => {
    const actual = await vi.importActual('@nostr-dev-kit/ndk');
    return {
        ...actual,
        zapInvoiceFromEvent: vi.fn(),
        NDKNutzap: {
            from: vi.fn(),
        },
    };
});

const createMockNDKEvent = (overrides: Partial<NDKEvent> = {}): NDKEvent =>
    ({
        kind: NDKKind.Zap,
        tags: [],
        tagValue: (key: string) => overrides.tags?.find?.((t) => t[0] === key)?.[1],
        ...overrides,
    }) as unknown as NDKEvent;

describe('PledgesService', () => {
    const user: Hexpubkey = getPublicKey(generateSecretKey());

    let service: PledgesService;

    const job = {
        jobAddress: 'job1',
        acceptedBidAddress: 'bid1',
        pubkey: 'clientPubkey',
    };

    const bid = {
        bidAddress: 'bid1',
        pledgeSplit: 30, // 30% to freelancer
        pubkey: 'freelancerPubkey',
    };

    const order = {
        orderAddress: 'order1',
        pledgeSplit: 40,
        referencedServiceAddress: 'service1',
    };

    const serviceEvent = {
        serviceAddress: 'service1',
        pubkey: 'freelancerPubkey',
    };

    let mockSubscribeCallback: (events: NDKEvent[]) => void;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock store subscription
        mockNDKStore.subscribe = vi.fn((callback) => {
            mockSubscribeCallback = callback;
            return () => {}; // unsubscribe function
        });

        service = new PledgesService(user);
    });

    // Initialization

    it('should update filters and start subscription on initialize()', () => {
        service.initialize(
            ['job1'],
            [job as JobEvent],
            [bid as BidEvent],
            ['order1'],
            [serviceEvent as ServiceEvent],
            [order as OrderEvent]
        );
        expect(mockNDKStore.startSubscription).toHaveBeenCalled();
    });

    // Pledge sum calculation
    it('should calculate pledge sum from zap event', () => {
        (zapInvoiceFromEvent as any).mockReturnValue({ amount: 5000 }); // msats
        const sum = service['calculatePledgeSum'](createMockNDKEvent({ kind: NDKKind.Zap }));
        expect(sum).toBe(5);
    });

    it('should calculate pledge sum from nutzap event', () => {
        (NDKNutzap.from as any).mockReturnValue({ amount: 2000 });
        const sum = service['calculatePledgeSum'](createMockNDKEvent({ kind: NDKKind.Nutzap }));
        expect(sum).toBe(2000);
    });

    it('should return 0 for unsupported kind', () => {
        const sum = service['calculatePledgeSum'](createMockNDKEvent({ kind: 9999 }));
        expect(sum).toBe(0);
    });

    // User share
    it('should calculate correct share for freelancer', () => {
        const share = service['calculateUserShare'](
            100,
            job as JobEvent,
            bid as BidEvent,
            'freelancerPubkey'
        );
        expect(share).toBe(30);
    });

    it('should calculate correct share for client', () => {
        const share = service['calculateUserShare'](
            100,
            job as JobEvent,
            bid as BidEvent,
            'clientPubkey'
        );
        expect(share).toBe(70);
    });

    it('should calculate correct share from order for freelancer', () => {
        const share = service['calculateUserShareFromOrder'](
            100,
            order as OrderEvent,
            serviceEvent as ServiceEvent,
            'freelancerPubkey'
        );
        expect(share).toBe(60);
    });

    it('should calculate correct share from order for client', () => {
        const share = service['calculateUserShareFromOrder'](
            100,
            order as OrderEvent,
            serviceEvent as ServiceEvent,
            'clientPubkey'
        );
        expect(share).toBe(40);
    });

    // Core pledge calc logic
    it('should return 0 if no pledgeSum > 0', () => {
        const result = service['calculatePledges']([], [], [], [], [], user);
        expect(result).toBe(0);
    });

    it('should sum valid zap events for jobs', () => {
        (zapInvoiceFromEvent as any).mockReturnValue({ amount: 10000 });
        const zap = createMockNDKEvent({
            kind: NDKKind.Zap,
            tags: [['a', 'job1']],
            tagValue: (key: string) => 'job1',
        });
        const result = service['calculatePledges'](
            [zap],
            [job as JobEvent],
            [bid as BidEvent],
            [],
            [],
            'freelancerPubkey'
        );
        expect(result).toBe(3); // 30% of 10
    });

    it('should sum valid zap events for orders', () => {
        (zapInvoiceFromEvent as any).mockReturnValue({ amount: 10000 });
        const zap = createMockNDKEvent({
            kind: NDKKind.Zap,
            tags: [['a', 'order1']],
            tagValue: (key: string) => 'order1',
        });
        const result = service['calculatePledges'](
            [zap],
            [],
            [],
            [serviceEvent as ServiceEvent],
            [order as OrderEvent],
            'freelancerPubkey'
        );
        expect(result).toBe(6); // 60% of 10
    });

    // Reactivity
    it('should update pledges when new events received', () => {
        (zapInvoiceFromEvent as any).mockReturnValue({ amount: 10000 });
        const zap = createMockNDKEvent({
            kind: NDKKind.Zap,
            tags: [['a', 'order1']],
            tagValue: (key: string) => 'order1',
        });
        service.initialize(
            ['job1'],
            [job as JobEvent],
            [bid as BidEvent],
            ['order1'],
            [serviceEvent as ServiceEvent],
            [order as OrderEvent]
        );

        mockSubscribeCallback([zap]);

        expect(service.getPledges()).toBe(4);
    });

    // Cleanup
    it('should clean up on destroy', () => {
        service.destroy();
        expect(mockNDKStore.empty).toHaveBeenCalled();
    });
});
