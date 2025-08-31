import { get } from 'svelte/store';
import {
    NDKEvent,
    NDKKind,
    NDKRelay,
    NDKSubscription,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { OrderEvent } from '$lib/events/OrderEvent';
import ndk from '$lib/stores/session';
import currentUserStore from '$lib/stores/user';
import { checkRelayConnections } from '$lib/utils/helpers';
import type { ContactService } from './ContactService.svelte';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

/**
 * Service for handling service-related functionality
 */
export class ServiceService {
    // Public state for direct access
    service = $state<ServiceEvent | null>(null);
    orders = $state<OrderEvent[]>([]);
    isOwner = $state<boolean>(false);

    // Private properties
    private serviceAddress: string;
    private relays: string[];
    private orderSubscription: NDKSubscription | null = null;

    constructor(serviceAddress: string, relays: string[]) {
        this.serviceAddress = serviceAddress;
        this.relays = relays;
    }

    /**
     * Initialize with other services
     */
    async initialize() {
        await this.initializeService();
    }

    /**
     * Initialize the service details
     */
    private async initializeService() {
        const ndkInstance = get(ndk);

        // Add relays from URL
        if (this.relays.length > 0) {
            this.relays.forEach((relayURL: string) => {
                if (relayURL) {
                    ndkInstance.pool.addRelay(new NDKRelay(relayURL, undefined, ndkInstance));
                }
            });
        }

        // Check relay connections
        try {
            await checkRelayConnections();
        } catch (error) {
            console.error('Error checking relay connections:', error);
        }

        // Fetch service details
        try {
            const serviceEvent = await ndkInstance.fetchEvent(
                this.serviceAddress,
                // Try to fetch latest state of the service
                // but fall back to cache
                { cacheUsage: NDKSubscriptionCacheUsage.PARALLEL }
            );

            if (serviceEvent) {
                this.handleServiceEvent(serviceEvent);
            } else {
                console.warn('Service could not be fetched in chat page!');
            }

            this.initializeOrdersSubscription();
        } catch (error) {
            console.error('Error fetching service details:', error);
        }
    }

    /**
     * Initialize subscription to orders for this service
     */
    private initializeOrdersSubscription() {
        const ndkInstance = get(ndk);

        try {
            const orderFilter: NDKFilter = {
                kinds: [ExtendedNDKKind.FreelanceOrder],
                '#a': [this.serviceAddress],
            };

            this.orderSubscription = ndkInstance.subscribe(orderFilter, { closeOnEose: false });
            this.orderSubscription.on('event', (event: NDKEvent) => {
                this.handleOrderEvent(event);
            });
        } catch (error) {
            console.error('Error setting up order subscription:', error);
        }
    }

    /**
     * Handle service event update
     */
    private handleServiceEvent(event: NDKEvent) {
        const serviceEvent = ServiceEvent.from(event);
        this.service = serviceEvent;

        // Check if current user is the service owner
        const currentUser = get(currentUserStore);
        if (currentUser && serviceEvent.pubkey === currentUser.pubkey) {
            this.isOwner = true;
        } else {
            this.isOwner = false;
        }
    }

    /**
     * Handle order event update
     */
    private handleOrderEvent(event: NDKEvent) {
        const orderEvent = OrderEvent.from(event);

        // Add to orders if not already present
        const existingIndex = this.orders.findIndex((o) => o.id === orderEvent.id);
        if (existingIndex >= 0) {
            // Create a new array with the updated order
            const updatedOrders = [...this.orders];
            updatedOrders[existingIndex] = orderEvent;
            this.orders = updatedOrders;
        } else {
            // Add new order
            this.orders = [...this.orders, orderEvent];
        }
    }

    /**
     * Unsubscribe from all subscriptions
     */
    unsubscribe() {
        if (this.orderSubscription) {
            this.orderSubscription.stop();
            this.orderSubscription = null;
        }
    }
}
