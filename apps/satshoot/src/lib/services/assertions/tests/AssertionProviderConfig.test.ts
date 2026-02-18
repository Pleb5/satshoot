import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssertionProviderConfig } from '../AssertionProviderConfig.svelte';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

const createMockNDK = () =>
    ({
        fetchEvents: vi.fn().mockResolvedValue(new Set()),
    }) as any;

const createMockEvent = (tags: string[][]): NDKEvent =>
    ({
        tags,
    }) as unknown as NDKEvent;

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
});
