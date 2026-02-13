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
 * Service for handling user payments calculations
 */
export class PaymentsService {
    // Private properties
    private paymentsStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    private user: Hexpubkey;
    private paymentsFilter: NDKFilter[];
    private lastContextKey = '';
    private started = false;

    // Reactive state
    payments = $state(0);

    constructor(user: Hexpubkey) {
        this.user = user;
        this.paymentsFilter = [
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
        this.paymentsStore = ndkInstance.storeSubscribe(this.paymentsFilter, {
            autoStart: false,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            closeOnEose: false,
            groupable: false,
        });

        this.paymentsStore.subscribe((ndkEvents) => {
            this.payments = calculateTotalAmount(ndkEvents);
        });
    }

    /**
     * Initialize payments tracking for the user
     */
    initialize(
        winningBidsForUser: string[],
        winningBidAddressesForUser: string[],
        ordersOfUser: string[]
    ) {
        this.updateContext(winningBidsForUser, winningBidAddressesForUser, ordersOfUser);
    }

    updateContext(
        winningBidsForUser: string[],
        winningBidAddressesForUser: string[],
        ordersOfUser: string[]
    ) {
        const nextWinningBids = Array.from(new Set(winningBidsForUser)).filter(Boolean);
        const nextBidAddresses = Array.from(new Set(winningBidAddressesForUser)).filter(Boolean);
        const nextOrders = Array.from(new Set(ordersOfUser)).filter(Boolean);
        const nextKey = this.buildContextKey(nextWinningBids, nextBidAddresses, nextOrders);

        if (nextKey === this.lastContextKey) return;
        this.lastContextKey = nextKey;

        // Update filter with winning bids for user's jobs
        this.paymentsFilter[0]['#e'] = nextWinningBids;

        // Update filter with winning bid addresses for user's jobs
        this.paymentsFilter[1]['#a'] = nextBidAddresses;

        // Update filter with orders of user
        this.paymentsFilter[2]['#a'] = nextOrders;

        if (this.paymentsStore.changeFilters) {
            this.paymentsStore.changeFilters(this.paymentsFilter);
        }

        if (!this.started) {
            this.paymentsStore.startSubscription();
            this.started = true;
        }
    }

    private buildContextKey(
        winningBidsForUser: string[],
        winningBidAddressesForUser: string[],
        ordersOfUser: string[]
    ): string {
        const bidsKey = [...winningBidsForUser].sort().join('|');
        const bidAddressKey = [...winningBidAddressesForUser].sort().join('|');
        const ordersKey = [...ordersOfUser].sort().join('|');
        return [bidsKey, bidAddressKey, ordersKey].join('::');
    }

    /**
     * Get current payments using reactive state
     */
    getPayments(): number {
        return this.payments;
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        if (this.paymentsStore) {
            this.paymentsStore.empty();
        }
    }
}
