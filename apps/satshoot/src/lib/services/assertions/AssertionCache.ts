import Dexie, { type Table } from 'dexie';
import type { Hexpubkey } from '@nostr-dev-kit/ndk';
import type { UserAssertion, EventAssertion, AddressableAssertion } from './types';

/**
 * Cache entry for user assertions
 */
export interface UserAssertionCacheEntry {
    pubkey: Hexpubkey;
    serviceKey: Hexpubkey;
    tag: string;
    assertion: UserAssertion;
    fetchedAt: number;
}

/**
 * Cache entry for event assertions
 */
export interface EventAssertionCacheEntry {
    eventId: string;
    serviceKey: Hexpubkey;
    tag: string;
    assertion: EventAssertion;
    fetchedAt: number;
}

/**
 * Cache entry for addressable assertions
 */
export interface AddressableAssertionCacheEntry {
    address: string;
    serviceKey: Hexpubkey;
    tag: string;
    assertion: AddressableAssertion;
    fetchedAt: number;
}

/**
 * Dexie database for assertion caching
 */
class AssertionCacheDB extends Dexie {
    userAssertions!: Table<UserAssertionCacheEntry, string>;
    eventAssertions!: Table<EventAssertionCacheEntry, string>;
    addressableAssertions!: Table<AddressableAssertionCacheEntry, string>;

    constructor() {
        super('assertionCache');
        this.version(1).stores({
            userAssertions: '[pubkey+serviceKey+tag], pubkey, fetchedAt',
            eventAssertions: '[eventId+serviceKey+tag], eventId, fetchedAt',
            addressableAssertions: '[address+serviceKey+tag], address, fetchedAt',
        });
    }
}

const db = new AssertionCacheDB();

/**
 * Cache TTL - 1 hour
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Assertion cache service
 */
export class AssertionCache {
    /**
     * Get cached user assertion
     */
    async getUserAssertion(
        pubkey: Hexpubkey,
        serviceKey: Hexpubkey,
        tag: string
    ): Promise<UserAssertion | null> {
        try {
            const entry = await db.userAssertions.get([pubkey, serviceKey, tag]);

            if (!entry) return null;

            // Check if cache is still valid
            const now = Date.now();
            if (now - entry.fetchedAt > CACHE_TTL_MS) {
                // Cache expired, delete it
                await db.userAssertions.delete([pubkey, serviceKey, tag]);
                return null;
            }

            return entry.assertion;
        } catch (error) {
            console.warn('Failed to get cached user assertion:', error);
            return null;
        }
    }

    /**
     * Cache user assertion
     */
    async setUserAssertion(
        pubkey: Hexpubkey,
        serviceKey: Hexpubkey,
        tag: string,
        assertion: UserAssertion
    ): Promise<void> {
        try {
            await db.userAssertions.put({
                pubkey,
                serviceKey,
                tag,
                assertion,
                fetchedAt: Date.now(),
            });
        } catch (error) {
            console.warn('Failed to cache user assertion:', error);
        }
    }

    /**
     * Get cached event assertion
     */
    async getEventAssertion(
        eventId: string,
        serviceKey: Hexpubkey,
        tag: string
    ): Promise<EventAssertion | null> {
        try {
            const entry = await db.eventAssertions.get([eventId, serviceKey, tag]);

            if (!entry) return null;

            const now = Date.now();
            if (now - entry.fetchedAt > CACHE_TTL_MS) {
                await db.eventAssertions.delete([eventId, serviceKey, tag]);
                return null;
            }

            return entry.assertion;
        } catch (error) {
            console.warn('Failed to get cached event assertion:', error);
            return null;
        }
    }

    /**
     * Cache event assertion
     */
    async setEventAssertion(
        eventId: string,
        serviceKey: Hexpubkey,
        tag: string,
        assertion: EventAssertion
    ): Promise<void> {
        try {
            await db.eventAssertions.put({
                eventId,
                serviceKey,
                tag,
                assertion,
                fetchedAt: Date.now(),
            });
        } catch (error) {
            console.warn('Failed to cache event assertion:', error);
        }
    }

    /**
     * Get cached addressable assertion
     */
    async getAddressableAssertion(
        address: string,
        serviceKey: Hexpubkey,
        tag: string
    ): Promise<AddressableAssertion | null> {
        try {
            const entry = await db.addressableAssertions.get([address, serviceKey, tag]);

            if (!entry) return null;

            const now = Date.now();
            if (now - entry.fetchedAt > CACHE_TTL_MS) {
                await db.addressableAssertions.delete([address, serviceKey, tag]);
                return null;
            }

            return entry.assertion;
        } catch (error) {
            console.warn('Failed to get cached addressable assertion:', error);
            return null;
        }
    }

    /**
     * Cache addressable assertion
     */
    async setAddressableAssertion(
        address: string,
        serviceKey: Hexpubkey,
        tag: string,
        assertion: AddressableAssertion
    ): Promise<void> {
        try {
            await db.addressableAssertions.put({
                address,
                serviceKey,
                tag,
                assertion,
                fetchedAt: Date.now(),
            });
        } catch (error) {
            console.warn('Failed to cache addressable assertion:', error);
        }
    }

    /**
     * Clear all cached assertions for a user
     */
    async clearUserAssertions(pubkey: Hexpubkey): Promise<void> {
        try {
            await db.userAssertions.where('pubkey').equals(pubkey).delete();
        } catch (error) {
            console.warn('Failed to clear user assertions:', error);
        }
    }

    /**
     * Clear old cache entries (older than TTL)
     */
    async clearExpiredCache(): Promise<void> {
        try {
            const now = Date.now();
            const cutoff = now - CACHE_TTL_MS;

            await Promise.all([
                db.userAssertions.where('fetchedAt').below(cutoff).delete(),
                db.eventAssertions.where('fetchedAt').below(cutoff).delete(),
                db.addressableAssertions.where('fetchedAt').below(cutoff).delete(),
            ]);
        } catch (error) {
            console.warn('Failed to clear expired cache:', error);
        }
    }

    /**
     * Clear all cached assertions
     */
    async clearAll(): Promise<void> {
        try {
            await Promise.all([
                db.userAssertions.clear(),
                db.eventAssertions.clear(),
                db.addressableAssertions.clear(),
            ]);
        } catch (error) {
            console.warn('Failed to clear all assertions:', error);
        }
    }
}

// Export singleton instance
export const assertionCache = new AssertionCache();
