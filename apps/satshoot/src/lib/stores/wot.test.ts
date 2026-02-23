import type { Hexpubkey } from '@nostr-dev-kit/ndk';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockAllJobs,
    mockAllBids,
    mockAllOrders,
    mockAllServices,
    mockCurrentUser,
    mockCurrentUserFreelanceFollows,
    mockFreelanceFollowNetwork,
    mockFreelanceFollowNetworkUpdated,
    mockFreelanceFollowSets,
    mockFollowsUpdated,
    mockNdkStore,
} = vi.hoisted(() => {
    type TestStore<T> = {
        subscribe: (run: (value: T) => void) => () => void;
        set: (value: T) => void;
        update: (updater: (value: T) => T) => void;
    };

    const createMockStore = <T>(value: T): TestStore<T> => {
        let current = value;
        const subscribers = new Set<(value: T) => void>();

        const subscribe = (run: (value: T) => void) => {
            run(current);
            subscribers.add(run);
            return () => subscribers.delete(run);
        };

        const set = (next: T) => {
            current = next;
            subscribers.forEach((run) => run(current));
        };

        const update = (updater: (value: T) => T) => {
            set(updater(current));
        };

        return { subscribe, set, update };
    };

    const mockAllJobs = createMockStore<any[]>([]);
    const mockAllBids = createMockStore<any[]>([]);
    const mockAllOrders = createMockStore<any[]>([]);
    const mockAllServices = createMockStore<any[]>([]);
    const mockCurrentUser = createMockStore<any>(null);
    const mockCurrentUserFreelanceFollows = createMockStore(new Set<Hexpubkey>());
    const mockFreelanceFollowNetwork = createMockStore(new Set<Hexpubkey>());
    const mockFreelanceFollowNetworkUpdated = createMockStore(0);
    const mockFreelanceFollowSets = createMockStore(new Map<Hexpubkey, any>());
    const mockFollowsUpdated = createMockStore(0);

    const storeSubscribe = vi.fn(() => {
        const store = createMockStore<any[]>([]);
        return {
            ...store,
            startSubscription: vi.fn(),
            empty: vi.fn(),
        };
    });
    const mockNdkStore = createMockStore({ storeSubscribe });

    return {
        mockAllJobs,
        mockAllBids,
        mockAllOrders,
        mockAllServices,
        mockCurrentUser,
        mockCurrentUserFreelanceFollows,
        mockFreelanceFollowNetwork,
        mockFreelanceFollowNetworkUpdated,
        mockFreelanceFollowSets,
        mockFollowsUpdated,
        mockNdkStore,
    };
});

vi.mock('$lib/stores/session', () => ({
    default: mockNdkStore,
}));

vi.mock('./freelance-eventstores', () => ({
    allJobs: mockAllJobs,
    allBids: mockAllBids,
    allOrders: mockAllOrders,
    allServices: mockAllServices,
}));

vi.mock('../stores/user', () => ({
    default: mockCurrentUser,
    currentUserFreelanceFollows: mockCurrentUserFreelanceFollows,
    fetchFreelanceFollowSet: vi.fn(),
    fetchFreelanceFollowSetWithCache: vi.fn(),
    freelanceFollowNetwork: mockFreelanceFollowNetwork,
    freelanceFollowNetworkUpdated: mockFreelanceFollowNetworkUpdated,
    freelanceFollowSets: mockFreelanceFollowSets,
    followsUpdated: mockFollowsUpdated,
}));

import { getSampledWoTPubkeys, myMuteList, networkWoTScores, minWot, useSatShootWoT, wot } from './wot';
import currentUser from '../stores/user';
import { allBids, allJobs, allOrders, allServices } from './freelance-eventstores';

const createMuteEvent = (pubkeys: Hexpubkey[]) => ({
    getMatchingTags: () => pubkeys.map((pubkey) => ['p', pubkey]),
});

describe('wot store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        networkWoTScores.set(new Map());
        minWot.set(3);
        useSatShootWoT.set(false);
        currentUser.set({ pubkey: 'user-a' } as any);
        mockCurrentUserFreelanceFollows.set(new Set());
        mockFreelanceFollowNetwork.set(new Set());
        allJobs.set([]);
        allBids.set([]);
        allOrders.set([]);
        allServices.set([]);
        myMuteList.set([]);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('adds counterparties from current user deals', () => {
        allBids.set([
            {
                pubkey: 'freelancer-b',
                bidAddress: 'bid-1',
            } as any,
        ]);
        allJobs.set([
            {
                pubkey: 'user-a',
                acceptedBidAddress: 'bid-1',
            } as any,
        ]);
        allServices.set([
            {
                pubkey: 'freelancer-c',
                serviceAddress: 'service-1',
            } as any,
        ]);
        allOrders.set([
            {
                pubkey: 'user-a',
                referencedServiceAddress: 'service-1',
            } as any,
        ]);

        const result = get(wot);

        expect(result.has('user-a')).toBe(true);
        expect(result.has('freelancer-b')).toBe(true);
        expect(result.has('freelancer-c')).toBe(true);
    });

    it('adds indirect deal links from direct partners', () => {
        allBids.set([
            {
                pubkey: 'partner-a',
                bidAddress: 'bid-2',
            } as any,
            {
                pubkey: 'indirect-b',
                bidAddress: 'bid-3',
            } as any,
        ]);
        allJobs.set([
            {
                pubkey: 'user-a',
                acceptedBidAddress: 'bid-2',
            } as any,
            {
                pubkey: 'partner-a',
                acceptedBidAddress: 'bid-3',
            } as any,
            {
                pubkey: 'stranger-job',
                acceptedBidAddress: 'bid-4',
            } as any,
        ]);
        allBids.update((bids) => [
            ...bids,
            {
                pubkey: 'stranger-bidder',
                bidAddress: 'bid-4',
            } as any,
        ]);

        const result = get(wot);

        expect(result.has('partner-a')).toBe(true);
        expect(result.has('indirect-b')).toBe(true);
        expect(result.has('stranger-job')).toBe(false);
        expect(result.has('stranger-bidder')).toBe(false);
    });

    it('adds freelance follow network members', () => {
        mockFreelanceFollowNetwork.set(new Set(['network-a', 'network-b']));

        const result = get(wot);

        expect(result.has('network-a')).toBe(true);
        expect(result.has('network-b')).toBe(true);
    });

    it('removes muted pubkeys even if added by deals', () => {
        allBids.set([
            {
                pubkey: 'muted-freelancer',
                bidAddress: 'bid-4',
            } as any,
            {
                pubkey: 'active-freelancer',
                bidAddress: 'bid-5',
            } as any,
        ]);
        allJobs.set([
            {
                pubkey: 'user-a',
                acceptedBidAddress: 'bid-4',
            } as any,
            {
                pubkey: 'user-a',
                acceptedBidAddress: 'bid-5',
            } as any,
        ]);
        myMuteList.set([createMuteEvent(['muted-freelancer']) as any]);

        const result = get(wot);

        expect(result.has('active-freelancer')).toBe(true);
        expect(result.has('muted-freelancer')).toBe(false);
    });

    it('returns full WoT when under the sample cap', () => {
        vi.stubGlobal('navigator', { deviceMemory: 2 });

        networkWoTScores.set(
            new Map([
                ['score-1', 5],
                ['score-2', 6],
            ])
        );
        mockCurrentUserFreelanceFollows.set(new Set(['freelance-a']));
        mockFreelanceFollowNetwork.set(new Set(['network-a']));

        const sampled = getSampledWoTPubkeys();
        const wotSet = get(wot);

        expect(sampled.length).toBe(wotSet.size);
        wotSet.forEach((pubkey) => {
            expect(sampled).toContain(pubkey);
        });
    });

    it('prioritizes freelance and deal links in the sampled set', () => {
        vi.stubGlobal('navigator', { deviceMemory: 2 });
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const scores = new Map<Hexpubkey, number>();
        for (let i = 0; i < 1200; i += 1) {
            scores.set(`score-${i}`, 10);
        }
        networkWoTScores.set(scores);

        mockCurrentUserFreelanceFollows.set(new Set(['priority-freelance']));
        mockFreelanceFollowNetwork.set(new Set(['priority-network']));
        allBids.set([
            {
                pubkey: 'priority-deal',
                bidAddress: 'bid-1',
            } as any,
        ]);
        allJobs.set([
            {
                pubkey: 'user-a',
                acceptedBidAddress: 'bid-1',
            } as any,
        ]);

        const sampled = getSampledWoTPubkeys();

        expect(sampled).toHaveLength(1200);
        expect(sampled).toEqual(
            expect.arrayContaining(['priority-freelance', 'priority-network', 'priority-deal'])
        );

        randomSpy.mockRestore();
    });
});
