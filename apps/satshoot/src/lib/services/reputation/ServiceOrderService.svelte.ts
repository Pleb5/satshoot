import {
    NDKSubscriptionCacheUsage,
    type Hexpubkey,
    type NDKSubscriptionOptions,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';
import type { ServiceOrderContext } from './types';
import { get, writable, type Unsubscriber } from 'svelte/store';
import ndk from '$lib/stores/session';
import { wot } from '$lib/stores/wot';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { OrderEvent } from '$lib/events/OrderEvent';
import { ExtendedNDKKind } from '$lib/types/ndkKind';
import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';

export class ServiceOrderService {
    private user: Hexpubkey;
    private contextStore = writable<ServiceOrderContext>({
        involvedServiceEvents: [],
        involvedOrderEvents: [],
        ordersOfUser: [],
        confirmOrders: [],
        involvedOrders: [],
    });
    private subscriptionsStarted = false;
    private storeUnsubs: Unsubscriber[] = [];
    private wotUnsub?: Unsubscriber;

    private userServicesStore?: NDKEventStore<ExtendedBaseType<ServiceEvent>>;
    private userOrdersStore?: NDKEventStore<ExtendedBaseType<OrderEvent>>;
    private ordersOnUserServicesStore?: NDKEventStore<ExtendedBaseType<OrderEvent>>;
    private servicesForUserOrdersStore?: NDKEventStore<ExtendedBaseType<ServiceEvent>>;

    private ordersOnUserServicesFilter: NDKFilter[] = [
        {
            kinds: [ExtendedNDKKind.FreelanceOrder],
            '#a': [],
        },
    ];
    private servicesForUserOrdersFilter: NDKFilter[] = [
        {
            kinds: [ExtendedNDKKind.FreelanceService],
            '#a': [],
        },
    ];

    private currentUserServices: ServiceEvent[] = [];
    private currentUserOrders: OrderEvent[] = [];
    private currentOrdersOnUserServices: OrderEvent[] = [];
    private currentServicesForUserOrders: ServiceEvent[] = [];
    private currentWot = new Set<Hexpubkey>();
    private lastOrdersFilterKey = '';
    private lastServicesFilterKey = '';
    private ordersOnUserServicesStarted = false;
    private servicesForUserOrdersStarted = false;

    constructor(user: Hexpubkey) {
        this.user = user;
    }

    subscribe(run: (context: ServiceOrderContext) => void): Unsubscriber {
        return this.contextStore.subscribe(run);
    }

    /**
     * Initialize and fetch all job and bid data for the user
     */
    async initialize(): Promise<ServiceOrderContext> {
        const subOptions: NDKSubscriptionOptions = {
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

        const context = this.normalizeContext({
            involvedServiceEvents,
            involvedOrderEvents,
            confirmOrders,
            ordersOfUser,
            involvedOrders,
        });

        this.contextStore.set(context);
        this.startSubscriptions();

        return context;
    }

    private normalizeContext(context: ServiceOrderContext): ServiceOrderContext {
        const serviceEvents = new Map<string, ServiceEvent>();
        const orderEvents = new Map<string, OrderEvent>();

        context.involvedServiceEvents.forEach((service) => {
            serviceEvents.set(service.serviceAddress, service);
        });

        context.involvedOrderEvents.forEach((order) => {
            orderEvents.set(order.orderAddress, order);
        });

        return {
            involvedServiceEvents: Array.from(serviceEvents.values()),
            involvedOrderEvents: Array.from(orderEvents.values()),
            confirmOrders: Array.from(new Set(context.confirmOrders)).filter(Boolean),
            ordersOfUser: Array.from(new Set(context.ordersOfUser)).filter(Boolean),
            involvedOrders: Array.from(new Set(context.involvedOrders)).filter(Boolean),
        };
    }

    private async processUserServices(
        subOptions: NDKSubscriptionOptions,
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
                kinds: [ExtendedNDKKind.FreelanceService],
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
                kinds: [ExtendedNDKKind.FreelanceOrder],
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
        subOptions: NDKSubscriptionOptions,
        ordersOfUser: string[],
        involvedOrders: string[],
        involvedServiceEvents: ServiceEvent[],
        involvedOrderEvents: OrderEvent[]
    ) {
        const ndkInstance = get(ndk);

        // Get user's orders
        const userOrders = await ndkInstance.fetchEvents(
            {
                kinds: [ExtendedNDKKind.FreelanceOrder],
                authors: [this.user],
            },
            subOptions
        );

        // all services on which user placed the order
        const ordersServices = await ndkInstance.fetchEvents({
            kinds: [ExtendedNDKKind.FreelanceService],
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

    private startSubscriptions() {
        if (this.subscriptionsStarted) return;
        this.subscriptionsStarted = true;

        const ndkInstance = get(ndk);
        const subOptions = {
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            closeOnEose: false,
            groupable: false,
            autoStart: false,
        };

        this.userServicesStore = ndkInstance.storeSubscribe<ServiceEvent>(
            {
                kinds: [ExtendedNDKKind.FreelanceService],
                authors: [this.user],
            },
            subOptions,
            ServiceEvent
        );

        this.userOrdersStore = ndkInstance.storeSubscribe<OrderEvent>(
            {
                kinds: [ExtendedNDKKind.FreelanceOrder],
                authors: [this.user],
            },
            subOptions,
            OrderEvent
        );

        this.ordersOnUserServicesStore = ndkInstance.storeSubscribe<OrderEvent>(
            this.ordersOnUserServicesFilter,
            subOptions,
            OrderEvent
        );

        this.servicesForUserOrdersStore = ndkInstance.storeSubscribe<ServiceEvent>(
            this.servicesForUserOrdersFilter,
            subOptions,
            ServiceEvent
        );

        this.userServicesStore.startSubscription();
        this.userOrdersStore.startSubscription();
        this.storeUnsubs.push(
            this.userServicesStore.subscribe((services) => {
                this.currentUserServices = services;
                this.updateOrdersOnUserServicesFilter(services);
                this.recomputeContext();
            })
        );

        this.storeUnsubs.push(
            this.userOrdersStore.subscribe((orders) => {
                this.currentUserOrders = orders;
                this.updateServicesForUserOrdersFilter(orders);
                this.recomputeContext();
            })
        );

        this.storeUnsubs.push(
            this.ordersOnUserServicesStore.subscribe((orders) => {
                this.currentOrdersOnUserServices = orders;
                this.recomputeContext();
            })
        );

        this.storeUnsubs.push(
            this.servicesForUserOrdersStore.subscribe((services) => {
                this.currentServicesForUserOrders = services;
                this.recomputeContext();
            })
        );

        this.wotUnsub = wot.subscribe((set) => {
            this.currentWot = set;
            this.recomputeContext();
        });
    }

    private updateOrdersOnUserServicesFilter(userServices: ServiceEvent[]) {
        if (!this.ordersOnUserServicesStore) return;
        const serviceAddresses = Array.from(
            new Set(userServices.map((service) => service.serviceAddress))
        );
        const nextKey = [...serviceAddresses].sort().join('|');
        if (nextKey === this.lastOrdersFilterKey) return;
        this.lastOrdersFilterKey = nextKey;
        if (serviceAddresses.length === 0) {
            this.ordersOnUserServicesStore.empty();
            this.ordersOnUserServicesStore.unsubscribe?.();
            this.ordersOnUserServicesStarted = false;
            this.currentOrdersOnUserServices = [];
            this.recomputeContext();
            return;
        }
        this.ordersOnUserServicesFilter[0]['#a'] = serviceAddresses;
        this.ordersOnUserServicesStore.changeFilters?.(this.ordersOnUserServicesFilter);
        this.ordersOnUserServicesStore.startSubscription();
        this.ordersOnUserServicesStarted = true;
    }

    private updateServicesForUserOrdersFilter(userOrders: OrderEvent[]) {
        if (!this.servicesForUserOrdersStore) return;
        const orderAddresses = Array.from(new Set(userOrders.map((order) => order.orderAddress)));
        const nextKey = [...orderAddresses].sort().join('|');
        if (nextKey === this.lastServicesFilterKey) return;
        this.lastServicesFilterKey = nextKey;
        if (orderAddresses.length === 0) {
            this.servicesForUserOrdersStore.empty();
            this.servicesForUserOrdersStore.unsubscribe?.();
            this.servicesForUserOrdersStarted = false;
            this.currentServicesForUserOrders = [];
            this.recomputeContext();
            return;
        }
        this.servicesForUserOrdersFilter[0]['#a'] = orderAddresses;
        this.servicesForUserOrdersStore.changeFilters?.(this.servicesForUserOrdersFilter);
        this.servicesForUserOrdersStore.startSubscription();
        this.servicesForUserOrdersStarted = true;
    }

    private recomputeContext() {
        const confirmOrders = new Set<string>();
        const ordersOfUser = new Set<string>();
        const involvedOrders = new Set<string>();
        const involvedServiceEvents = new Map<string, ServiceEvent>();
        const involvedOrderEvents = new Map<string, OrderEvent>();

        const acceptedOrderAddresses = new Set<string>();
        for (const service of this.currentUserServices) {
            involvedServiceEvents.set(service.serviceAddress, service);
            service.orders.forEach((orderAddress) => acceptedOrderAddresses.add(orderAddress));
        }

        for (const order of this.currentOrdersOnUserServices) {
            if (!acceptedOrderAddresses.has(order.orderAddress)) continue;
            if (!this.currentWot.has(order.pubkey)) continue;
            confirmOrders.add(order.orderAddress);
            involvedOrders.add(order.orderAddress);
            involvedOrderEvents.set(order.orderAddress, order);
        }

        for (const order of this.currentUserOrders) {
            ordersOfUser.add(order.orderAddress);
            involvedOrders.add(order.orderAddress);
            involvedOrderEvents.set(order.orderAddress, order);
        }

        for (const service of this.currentServicesForUserOrders) {
            involvedServiceEvents.set(service.serviceAddress, service);
        }

        this.contextStore.set({
            involvedServiceEvents: Array.from(involvedServiceEvents.values()),
            involvedOrderEvents: Array.from(involvedOrderEvents.values()),
            ordersOfUser: Array.from(ordersOfUser),
            confirmOrders: Array.from(confirmOrders),
            involvedOrders: Array.from(involvedOrders),
        });
    }

    destroy() {
        this.storeUnsubs.forEach((unsub) => unsub());
        this.storeUnsubs = [];
        if (this.wotUnsub) {
            this.wotUnsub();
            this.wotUnsub = undefined;
        }
        this.subscriptionsStarted = false;
        this.userServicesStore?.unsubscribe?.();
        this.userOrdersStore?.unsubscribe?.();
        this.ordersOnUserServicesStore?.unsubscribe?.();
        this.servicesForUserOrdersStore?.unsubscribe?.();
        this.ordersOnUserServicesStarted = false;
        this.servicesForUserOrdersStarted = false;

        this.userServicesStore?.empty();
        this.userOrdersStore?.empty();
        this.ordersOnUserServicesStore?.empty();
        this.servicesForUserOrdersStore?.empty();
    }
}
