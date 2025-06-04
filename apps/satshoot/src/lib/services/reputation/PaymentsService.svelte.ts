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
 * Service for handling user payments calculations
 */
export class PaymentsService {
    // Private properties
    private paymentsStore: any = null;
    private user: Hexpubkey;
    private paymentsFilter: NDKFilter;

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
     * Get current payments using derived state
     */
    getPayments(): number {
        if (!this.paymentsStore) return 0;
        return calculateTotalAmount(Array.from(this.paymentsStore));
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        if (this.paymentsStore) {
            this.paymentsStore.empty();
            this.paymentsStore = null;
        }
    }
}
