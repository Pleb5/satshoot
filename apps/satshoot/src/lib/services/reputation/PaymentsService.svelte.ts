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
    private paymentsFilter: NDKFilter;

    // Reactive state
    payments = $state(0);

    constructor(user: Hexpubkey) {
        this.user = user;
        this.paymentsFilter = {
            kinds: [NDKKind.Zap, NDKKind.Nutzap],
        };

        const ndkInstance = get(ndk);
        this.paymentsStore = ndkInstance.storeSubscribe(this.paymentsFilter, {
            autoStart: false,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        });

        this.paymentsStore.subscribe((ndkEvents) => {
            this.payments = calculateTotalAmount(ndkEvents);
        });
    }

    /**
     * Initialize payments tracking for the user
     */
    initialize(winningBidsForUser: string[]) {
        // Update filter with winning bids for user's jobs
        this.paymentsFilter['#e'] = winningBidsForUser;

        this.paymentsStore.startSubscription();
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
