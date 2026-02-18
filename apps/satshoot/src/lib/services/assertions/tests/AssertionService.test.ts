import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssertionService } from '../AssertionService.svelte';
import type { TrustedProvider } from '../types';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

vi.mock('../AssertionCache', () => ({
    assertionCache: {
        getUserAssertion: vi.fn().mockResolvedValue(null),
        setUserAssertion: vi.fn(),
        getEventAssertion: vi.fn().mockResolvedValue(null),
        setEventAssertion: vi.fn(),
        getAddressableAssertion: vi.fn().mockResolvedValue(null),
        setAddressableAssertion: vi.fn(),
    },
}));

const createMockEvent = (tags: string[][]): NDKEvent =>
    ({
        tags,
        tagValue: (name: string) => tags.find((tag) => tag[0] === name)?.[1],
    }) as unknown as NDKEvent;

const createMockNDK = (events: NDKEvent[]) =>
    ({
        fetchEvents: vi.fn().mockResolvedValue(new Set(events)),
    }) as any;

describe('AssertionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses user assertions with numeric values', async () => {
        const event = createMockEvent([
            ['d', 'userpubkey'],
            ['rank', '87'],
            ['followers', '1500'],
            ['zap_amt_recd', '100000'],
            ['post_cnt', '42'],
            ['t', 'nostr'],
        ]);

        const ndk = createMockNDK([event]);
        const service = new AssertionService(ndk, false);

        const providers: TrustedProvider[] = [
            {
                kindTag: '30382:rank',
                serviceKey: 'servicekey' as any,
                relayHint: 'wss://relay',
                kind: 30382,
                tag: 'rank',
            },
        ];

        const assertions = await service.fetchUserAssertions('userpubkey' as any, providers);
        const assertion = assertions.values().next().value;

        expect(assertion.rank).toBe(87);
        expect(assertion.followers).toBe(1500);
        expect(assertion.zapAmtRecd).toBe(100000);
        expect(assertion.postCnt).toBe(42);
        expect(assertion.commonTopics).toEqual(['nostr']);
    });

    it('uses median for trusted value aggregation', () => {
        const ndk = createMockNDK([]);
        const service = new AssertionService(ndk, false);

        const assertions = new Map<string, any>([
            ['a', { rank: 10 }],
            ['b', { rank: 30 }],
            ['c', { rank: 20 }],
        ]);

        const trusted = service.getTrustedValue(assertions, 'rank');
        expect(trusted).toBe(20);
    });

    it('returns null for missing metrics', () => {
        const ndk = createMockNDK([]);
        const service = new AssertionService(ndk, false);

        const assertions = new Map<string, any>([['a', { followers: 5 }]]);
        const trusted = service.getTrustedValue(assertions, 'rank');
        expect(trusted).toBeNull();
    });
});
