import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    AssertionProviderConfig,
    aggregateProviderWebsiteRecommendations,
    displayProviderWebsite,
    normalizeProviderWebsite,
} from '../AssertionProviderConfig.svelte';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { ProviderInfo, TrustedProvider } from '../types';

const createMockNDK = () =>
    ({
        fetchEvents: vi.fn().mockResolvedValue(new Set()),
    }) as any;

const createMockEvent = (tags: string[][]): NDKEvent =>
    ({
        tags,
    }) as unknown as NDKEvent;

const makeProvider = (
    kindTag: string,
    serviceKey: string,
    relayHint = 'wss://relay.example.com'
): TrustedProvider => {
    const [kind, tag] = kindTag.split(':');

    return {
        kindTag,
        serviceKey,
        relayHint,
        kind: Number(kind),
        tag: tag ?? kindTag,
    };
};

const makeProviderInfo = (serviceKey: string, website?: string): ProviderInfo => ({
    serviceKey,
    relayHint: 'wss://relay.example.com',
    website,
    capabilities: new Map(),
    totalUsageCount: 0,
});

describe('AssertionProviderConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses valid provider tags and skips invalid ones', () => {
        const ndk = createMockNDK();
        const service = new AssertionProviderConfig(ndk);

        const event = createMockEvent([
            ['30382:rank', 'servicekey', 'wss://relay'],
            ['invalid', 'servicekey', 'wss://relay'],
            ['30383:reaction_cnt', 'servicekey2', 'wss://relay2'],
        ]);

        const providers = service.parseProviderEvent(event);

        expect(providers).toHaveLength(2);
        expect(providers[0]?.kind).toBe(30382);
        expect(providers[0]?.tag).toBe('rank');
        expect(providers[1]?.kind).toBe(30383);
        expect(providers[1]?.tag).toBe('reaction_cnt');
    });

    it('normalizes and displays provider websites consistently', () => {
        const normalized = normalizeProviderWebsite('https://www.nip85.example.com/');

        expect(normalized).toBe('https://nip85.example.com');
        expect(displayProviderWebsite(normalized)).toBe('nip85.example.com');
    });

    it('aggregates website recommendations across all provider profiles', () => {
        const providerA = makeProvider('30382:rank', 'a'.repeat(64), 'wss://a.example.com');
        const providerB = makeProvider('30382:followers', 'b'.repeat(64), 'wss://b.example.com');
        const providerC = makeProvider('30383:reaction_cnt', 'c'.repeat(64), 'wss://c.example.com');
        const providerWithoutWebsite = makeProvider(
            '30382:rank',
            'd'.repeat(64),
            'wss://d.example.com'
        );

        const recommendations = aggregateProviderWebsiteRecommendations(
            new Map([
                ['1'.repeat(64), [providerA, providerB, providerC]],
                ['2'.repeat(64), [providerB]],
                ['3'.repeat(64), [providerWithoutWebsite]],
            ]),
            new Map([
                [providerA.serviceKey, makeProviderInfo(providerA.serviceKey, 'https://nip85.example.com/')],
                [providerB.serviceKey, makeProviderInfo(providerB.serviceKey, 'https://www.nip85.example.com')],
                [providerC.serviceKey, makeProviderInfo(providerC.serviceKey, 'service.example.com/tools')],
                [providerWithoutWebsite.serviceKey, makeProviderInfo(providerWithoutWebsite.serviceKey)],
            ])
        );

        expect(recommendations).toEqual([
            {
                website: 'https://nip85.example.com',
                usageCount: 2,
                serviceKeys: [providerA.serviceKey, providerB.serviceKey],
                capabilityCount: 2,
            },
            {
                website: 'https://service.example.com/tools',
                usageCount: 1,
                serviceKeys: [providerC.serviceKey],
                capabilityCount: 1,
            },
        ]);
    });
});
