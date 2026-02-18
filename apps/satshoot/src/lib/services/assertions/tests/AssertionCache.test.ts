import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssertionCache } from '../AssertionCache';
import type { UserAssertion } from '../types';

vi.mock('dexie', () => {
    class MockTable {
        data = new Map<string, any>();
        async get(key: any) {
            return this.data.get(JSON.stringify(key));
        }
        async put(value: any) {
            this.data.set(JSON.stringify([value.pubkey, value.serviceKey, value.tag]), value);
        }
        async delete(key: any) {
            this.data.delete(JSON.stringify(key));
        }
        where() {
            return {
                equals: () => ({ delete: vi.fn() }),
                below: () => ({ delete: vi.fn() }),
            };
        }
        async clear() {
            this.data.clear();
        }
    }

    class MockDexie {
        userAssertions = new MockTable();
        eventAssertions = new MockTable();
        addressableAssertions = new MockTable();
        version() {
            return { stores: vi.fn() };
        }
    }

    return { default: MockDexie, Table: MockTable };
});

describe('AssertionCache', () => {
    let cache: AssertionCache;

    beforeEach(() => {
        cache = new AssertionCache();
    });

    it('stores and retrieves user assertions', async () => {
        const assertion: UserAssertion = { pubkey: 'user' as any, rank: 50 };

        await cache.setUserAssertion('user' as any, 'service' as any, 'rank', assertion);
        const result = await cache.getUserAssertion('user' as any, 'service' as any, 'rank');

        expect(result?.rank).toBe(50);
    });

    it('returns null for missing cache', async () => {
        const result = await cache.getUserAssertion('user' as any, 'service' as any, 'rank');
        expect(result).toBeNull();
    });
});
