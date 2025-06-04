import {
    NDKKind,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
    type Hexpubkey,
} from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';
import { get } from 'svelte/store';
import { calculateTotalAmount } from './utils';

/**
 * Service for handling user earnings calculations
 */
export class EarningsService {
    // Private properties
    private earningsStore: any = null;
    private user: Hexpubkey;
    private earningsFilter: NDKFilter;

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
     * Get current earnings using derived state
     */
    getEarnings(): number {
        if (!this.earningsStore) return 0;
        return calculateTotalAmount(Array.from(this.earningsStore));
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        if (this.earningsStore) {
            this.earningsStore.empty();
            this.earningsStore = null;
        }
    }
}
