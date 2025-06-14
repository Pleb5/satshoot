import { NDKKind, NDKSubscriptionCacheUsage, type Hexpubkey } from '@nostr-dev-kit/ndk';
import type { ServiceOrderContext } from './types';
import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
import { get } from 'svelte/store';
import ndk from '$lib/stores/session';
import { wot } from '$lib/stores/wot';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { OrderEvent } from '$lib/events/OrderEvent';

export class ServiceOrderService {
    private user: Hexpubkey;

    constructor(user: Hexpubkey) {
        this.user = user;
    }

    /**
     * Initialize and fetch all job and bid data for the user
     */
    async initialize(): Promise<ServiceOrderContext> {
        const subOptions: NDKSubscribeOptions = {
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        };

        const confirmOrders: string[] = [];
        const ordersOfUser: string[] = [];
        const involvedOrders: string[] = [];
        const involvedServiceEvents: ServiceEvent[] = [];
        const involvedOrderEvents: OrderEvent[] = [];

        // Process user's services (earnings)
        await this.processUserServices(
            subOptions,
            confirmOrders,
            involvedOrders,
            involvedServiceEvents,
            involvedOrderEvents
        );

        await this.processUserOrders(
            subOptions,
            ordersOfUser,
            involvedOrders,
            involvedServiceEvents,
            involvedOrderEvents
        );

        return {
            involvedServiceEvents,
            involvedOrderEvents,
            confirmOrders,
            ordersOfUser,
            involvedOrders,
        };
    }

    private async processUserServices(
        subOptions: NDKSubscribeOptions,
        confirmOrders: string[],
        involvedOrders: string[],
        involvedServiceEvents: ServiceEvent[],
        involvedOrderEvents: OrderEvent[]
    ) {
        const ndkInstance = get(ndk);
        const wotStore = get(wot);

        // Get user's services
        const userServices = await ndkInstance.fetchEvents(
            {
                kinds: [NDKKind.FreelanceService],
                authors: [this.user],
            },
            subOptions
        );

        userServices.forEach((s) => {
            const serviceEvent = ServiceEvent.from(s);
            involvedServiceEvents.push(serviceEvent);
        });

        const allOrdersOnUserServices = await ndkInstance.fetchEvents(
            {
                kinds: [NDKKind.FreelanceOrder],
                '#a': Array.from(userServices).map((s) => s.tagAddress()),
            },
            subOptions
        );

        const allAcceptedOrders = Array.from(userServices)
            .map((s) => {
                const serviceEvent = ServiceEvent.from(s);
                return serviceEvent.orders;
            })
            .flat();

        for (const order of allOrdersOnUserServices) {
            const orderEvent = OrderEvent.from(order);
            if (
                wotStore.has(orderEvent.pubkey) &&
                allAcceptedOrders.includes(orderEvent.orderAddress)
            ) {
                confirmOrders.push(orderEvent.orderAddress);
                involvedOrders.push(orderEvent.orderAddress);
                involvedOrderEvents.push(orderEvent);
            }
        }
    }

    private async processUserOrders(
        subOptions: NDKSubscribeOptions,
        ordersOfUser: string[],
        involvedOrders: string[],
        involvedServiceEvents: ServiceEvent[],
        involvedOrderEvents: OrderEvent[]
    ) {
        const ndkInstance = get(ndk);
        const wotStore = get(wot);

        // Get user's orders
        const userOrders = await ndkInstance.fetchEvents(
            {
                kinds: [NDKKind.FreelanceOrder],
                authors: [this.user],
            },
            subOptions
        );

        // all services on which user placed the order
        const ordersServices = await ndkInstance.fetchEvents({
            kinds: [NDKKind.FreelanceService],
            '#a': Array.from(userOrders).map((o) => o.tagAddress()),
        });

        Array.from(ordersServices).forEach((s) => {
            const serviceEvent = ServiceEvent.from(s);
            involvedServiceEvents.push(serviceEvent);
        });

        for (const order of userOrders) {
            const orderEvent = OrderEvent.from(order);

            ordersOfUser.push(orderEvent.orderAddress);
            involvedOrders.push(orderEvent.orderAddress);
            involvedOrderEvents.push(orderEvent);
        }
    }
}
