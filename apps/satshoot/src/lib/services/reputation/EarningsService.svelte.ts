import {
    NDKKind,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
    type Hexpubkey,
    NDKEvent,
} from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';
import { get } from 'svelte/store';
import { calculateTotalAmount } from './utils';
import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';

/**
 * Service for handling user earnings calculations
 */
export class EarningsService {
    // Private properties
    private earningsStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    private user: Hexpubkey;
    private earningsFilter: NDKFilter;

    earnings = $state(0);

    constructor(user: Hexpubkey) {
        this.user = user;
        this.earningsFilter = {
            kinds: [NDKKind.Zap, NDKKind.Nutzap],
        };

        const ndkInstance = get(ndk);
        this.earningsStore = ndkInstance.storeSubscribe(this.earningsFilter, {
            autoStart: false,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        });

        this.earningsStore.subscribe((ndkEvents) => {
            this.earnings = calculateTotalAmount(ndkEvents);
        });
    }

    /**
     * Initialize earnings tracking for the user
     */
    initialize(winningBidsOfUser: string[]) {
        // Update filter with user and winning bids
        this.earningsFilter['#p'] = [this.user];
        this.earningsFilter['#e'] = winningBidsOfUser;

        this.earningsStore.startSubscription();
    }

    /**
     * Get current earnings using reactive state
     */
    getEarnings(): number {
        return this.earnings;
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        if (this.earningsStore) {
            this.earningsStore.empty();
        }
    }
}
