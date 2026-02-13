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
    private earningsFilter: NDKFilter[];
    private lastContextKey = '';
    private started = false;

    earnings = $state(0);

    constructor(user: Hexpubkey) {
        this.user = user;
        this.earningsFilter = [
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
            },
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
            },
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
            },
        ];

        const ndkInstance = get(ndk);
        this.earningsStore = ndkInstance.storeSubscribe(this.earningsFilter, {
            autoStart: false,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            closeOnEose: false,
            groupable: false,
        });

        this.earningsStore.subscribe((ndkEvents) => {
            this.earnings = calculateTotalAmount(ndkEvents);
        });
    }

    /**
     * Initialize earnings tracking for the user
     */
    initialize(
        winningBidsOfUser: string[],
        winningBidAddressesOfUser: string[],
        confirmOrders: string[]
    ) {
        this.updateContext(winningBidsOfUser, winningBidAddressesOfUser, confirmOrders);
    }

    updateContext(
        winningBidsOfUser: string[],
        winningBidAddressesOfUser: string[],
        confirmOrders: string[]
    ) {
        const nextWinningBids = Array.from(new Set(winningBidsOfUser)).filter(Boolean);
        const nextBidAddresses = Array.from(new Set(winningBidAddressesOfUser)).filter(Boolean);
        const nextOrders = Array.from(new Set(confirmOrders)).filter(Boolean);
        const nextKey = this.buildContextKey(nextWinningBids, nextBidAddresses, nextOrders);

        if (nextKey === this.lastContextKey) return;
        this.lastContextKey = nextKey;

        // Update filter with user and winning bids
        this.earningsFilter[0]['#p'] = [this.user];
        this.earningsFilter[0]['#e'] = nextWinningBids;

        // Update filter with user and winning bid addresses
        this.earningsFilter[1]['#p'] = [this.user];
        this.earningsFilter[1]['#a'] = nextBidAddresses;

        // Update filter with user and confirm orders
        this.earningsFilter[2]['#p'] = [this.user];
        this.earningsFilter[2]['#a'] = nextOrders;

        if (this.earningsStore.changeFilters) {
            this.earningsStore.changeFilters(this.earningsFilter);
        }

        if (!this.started) {
            this.earningsStore.startSubscription();
            this.started = true;
        }
    }

    private buildContextKey(
        winningBidsOfUser: string[],
        winningBidAddressesOfUser: string[],
        confirmOrders: string[]
    ): string {
        const bidsKey = [...winningBidsOfUser].sort().join('|');
        const bidAddressKey = [...winningBidAddressesOfUser].sort().join('|');
        const ordersKey = [...confirmOrders].sort().join('|');
        return [bidsKey, bidAddressKey, ordersKey].join('::');
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
