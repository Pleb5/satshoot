import { ServiceOrderService } from '../ServiceOrderService.svelte';
import { getPublicKey, generateSecretKey } from 'nostr-tools';
import { NDKKind } from '@nostr-dev-kit/ndk';
import { vi } from 'vitest';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { OrderEvent } from '$lib/events/OrderEvent';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

// Mock dependencies
const mockNDKStore = {
    startSubscription: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    changeFilters: vi.fn(),
    empty: vi.fn(),
    unsubscribe: vi.fn(),
};

const mockNDKInstance = {
    fetchEvents: vi.fn().mockResolvedValue(new Set()),
    storeSubscribe: vi.fn(() => mockNDKStore),
};

const mockWotStore = {
    has: vi.fn().mockReturnValue(true),
};

// Mock stores
vi.mock('$lib/stores/session', () => ({
    default: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        fetchEvents: vi.fn(),
    },
}));

vi.mock('$lib/stores/wot', () => ({
    wot: {
        subscribe: vi.fn(() => () => {}),
        set: vi.fn(),
        update: vi.fn(),
    },
}));

// Mock svelte/store get function
vi.mock('svelte/store', async (importOriginal) => {
    const actual = await importOriginal<typeof import('svelte/store')>();
    return {
        ...actual,
        get: vi.fn((store) => {
            if (store?.fetchEvents) {
                return mockNDKInstance;
            }
            return mockWotStore;
        }),
    };
});

// Mock event classes
vi.mock('$lib/events/ServiceEvent', () => ({
    ServiceEvent: {
        from: vi.fn((event) => ({
            serviceAddress: event.tagAddress(),
            orders: event.tags?.filter((tag) => tag[0] === 'a').map((tag) => tag[1]) ?? [],
            pubkey: event.pubkey,
        })),
    },
}));

vi.mock('$lib/events/OrderEvent', () => ({
    OrderEvent: {
        from: vi.fn((event) => ({
            orderAddress: event.tagAddress(),
            pubkey: event.pubkey,
        })),
    },
}));

vi.mock('@nostr-dev-kit/ndk', async () => {
    const actual = await vi.importActual('@nostr-dev-kit/ndk');
    return {
        ...actual,
        default: vi.fn(() => mockNDKInstance),
    };
});

// Helper function to create mock NDK events
const createMockNDKEvent = ({
    id = 'mock-event-id',
    kind,
    pubkey = 'mock-pubkey',
    tagAddress = () => `mock-address-${id}`,
    tags = [],
}: {
    id?: string;
    kind: NDKKind;
    pubkey?: string;
    tagAddress?: () => string;
    tags?: string[][];
}) => ({
    id,
    kind,
    pubkey,
    tagAddress,
    tags,
});

describe('ServiceOrderService', () => {
    const testUser = getPublicKey(generateSecretKey());
    const otherUser = getPublicKey(generateSecretKey());
    let service: ServiceOrderService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ServiceOrderService(testUser);

        // Reset mock implementations
        mockNDKInstance.fetchEvents.mockResolvedValue(new Set());
        mockWotStore.has.mockReturnValue(true);
        (ServiceEvent.from as any).mockImplementation((event) => ({
            serviceAddress: event.tagAddress(),
            orders: event.tags?.filter((tag) => tag[0] === 'a').map((tag) => tag[1]) ?? [],
            pubkey: event.pubkey,
        }));
        (OrderEvent.from as any).mockImplementation((event) => ({
            orderAddress: event.tagAddress(),
            pubkey: event.pubkey,
        }));
    });

    describe('constructor', () => {
        it('should create service instance with user pubkey', () => {
            expect(service).toBeInstanceOf(ServiceOrderService);
        });
    });

    describe('initialize', () => {
        it('should return correct context structure', async () => {
            const result = await service.initialize();

            expect(result).toHaveProperty('involvedServiceEvents');
            expect(result).toHaveProperty('involvedOrderEvents');
            expect(result).toHaveProperty('confirmOrders');
            expect(result).toHaveProperty('ordersOfUser');
            expect(result).toHaveProperty('involvedOrders');
        });

        it('should handle empty results', async () => {
            const result = await service.initialize();

            expect(result.involvedServiceEvents).toHaveLength(0);
            expect(result.involvedOrderEvents).toHaveLength(0);
            expect(result.confirmOrders).toHaveLength(0);
            expect(result.ordersOfUser).toHaveLength(0);
            expect(result.involvedOrders).toHaveLength(0);
        });
    });

    describe('processUserServices', () => {
        it('should process user services and related orders', async () => {
            const serviceEvent = createMockNDKEvent({
                id: 'service-1',
                kind: ExtendedNDKKind.FreelanceService,
                pubkey: testUser,
            });

            const orderEvent = createMockNDKEvent({
                id: 'order-1',
                kind: ExtendedNDKKind.FreelanceOrder,
                pubkey: otherUser,
                tags: [['a', serviceEvent.tagAddress()]],
            });

            serviceEvent.tags.push(['a', orderEvent.tagAddress()]);

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce(new Set([serviceEvent])) // userServices
                .mockResolvedValueOnce(new Set([orderEvent])); // allOrdersOnUserServices

            (ServiceEvent.from as any).mockReturnValue({
                ...serviceEvent,
                orders: [orderEvent.tagAddress()],
            });

            const confirmOrders: string[] = [];
            const involvedOrders: string[] = [];
            const involvedServiceEvents: ServiceEvent[] = [];
            const involvedOrderEvents: OrderEvent[] = [];

            await service['processUserServices'](
                {},
                confirmOrders,
                involvedOrders,
                involvedServiceEvents,
                involvedOrderEvents
            );

            expect(involvedServiceEvents).toHaveLength(1);
            expect(involvedOrderEvents).toHaveLength(1);
            expect(confirmOrders).toContain(orderEvent.tagAddress());
            expect(involvedOrders).toContain(orderEvent.tagAddress());
        });

        it('should filter orders not in WoT', async () => {
            const serviceEvent = createMockNDKEvent({
                id: 'service-1',
                kind: ExtendedNDKKind.FreelanceService,
                pubkey: testUser,
            });

            const orderEvent = createMockNDKEvent({
                id: 'order-1',
                kind: ExtendedNDKKind.FreelanceOrder,
                pubkey: 'untrusted-user',
                tags: [['a', serviceEvent.tagAddress()]],
            });

            mockWotStore.has.mockImplementation((pubkey) => pubkey !== 'untrusted-user');
            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce(new Set([serviceEvent]))
                .mockResolvedValueOnce(new Set([orderEvent]));

            const confirmOrders: string[] = [];
            const involvedOrders: string[] = [];
            const involvedServiceEvents: ServiceEvent[] = [];
            const involvedOrderEvents: OrderEvent[] = [];

            await service['processUserServices'](
                {},
                confirmOrders,
                involvedOrders,
                involvedServiceEvents,
                involvedOrderEvents
            );

            expect(confirmOrders).toHaveLength(0);
        });
    });

    describe('processUserOrders', () => {
        it('should process user orders and related services', async () => {
            const orderEvent = createMockNDKEvent({
                id: 'order-1',
                kind: ExtendedNDKKind.FreelanceOrder,
                pubkey: testUser,
            });

            const serviceEvent = createMockNDKEvent({
                id: 'service-1',
                kind: ExtendedNDKKind.FreelanceService,
                pubkey: otherUser,
                tags: [['a', orderEvent.tagAddress()]],
            });

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce(new Set([orderEvent])) // userOrders
                .mockResolvedValueOnce(new Set([serviceEvent])); // ordersServices

            const ordersOfUser: string[] = [];
            const involvedOrders: string[] = [];
            const involvedServiceEvents: ServiceEvent[] = [];
            const involvedOrderEvents: OrderEvent[] = [];

            await service['processUserOrders'](
                {},
                ordersOfUser,
                involvedOrders,
                involvedServiceEvents,
                involvedOrderEvents
            );

            expect(ordersOfUser).toContain(orderEvent.tagAddress());
            expect(involvedOrders).toContain(orderEvent.tagAddress());
            expect(involvedServiceEvents).toHaveLength(1);
            expect(involvedOrderEvents).toHaveLength(1);
        });
    });

    describe('integration', () => {
        it('should handle complex scenario with multiple services and orders', async () => {
            // User services
            const service1 = createMockNDKEvent({
                id: 'service-1',
                kind: ExtendedNDKKind.FreelanceService,
                pubkey: testUser,
                tags: [['d', 'service-1']],
            });

            const service2 = createMockNDKEvent({
                id: 'service-2',
                kind: ExtendedNDKKind.FreelanceService,
                pubkey: testUser,
                tags: [['d', 'service-2']],
            });

            // Orders on user services
            const order1 = createMockNDKEvent({
                id: 'order-1',
                kind: ExtendedNDKKind.FreelanceOrder,
                pubkey: otherUser,
                tags: [['d', 'order-1'], ['a', service1.tagAddress()]],
            });

            // User orders
            const userOrder = createMockNDKEvent({
                id: 'user-order',
                kind: ExtendedNDKKind.FreelanceOrder,
                pubkey: testUser,
                tags: [['d', 'user-order']],
            });

            // Service for user order
            const serviceForOrder = createMockNDKEvent({
                id: 'service-for-order',
                kind: ExtendedNDKKind.FreelanceService,
                pubkey: otherUser,
                tags: [['d', 'service-for-order'], ['a', userOrder.tagAddress()]],
            });

            service1.tags.push(['a', order1.tagAddress()]);

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce(new Set([service1, service2])) // userServices
                .mockResolvedValueOnce(new Set([order1])) // allOrdersOnUserServices
                .mockResolvedValueOnce(new Set([userOrder])) // userOrders
                .mockResolvedValueOnce(new Set([serviceForOrder])); // ordersServices

            const result = await service.initialize();

            expect(result.involvedServiceEvents).toHaveLength(3);
            expect(result.involvedOrderEvents).toHaveLength(2);
            expect(result.confirmOrders).toContain(order1.tagAddress());
            expect(result.ordersOfUser).toContain(userOrder.tagAddress());
            expect(result.involvedOrders).toHaveLength(2);
        });
    });
});
