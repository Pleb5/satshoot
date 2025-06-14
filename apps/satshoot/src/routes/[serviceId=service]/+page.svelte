<script lang="ts">
    import { page } from '$app/state';
    import OrderCard from '$lib/components/Cards/OrderCard.svelte';
    import ServiceCard from '$lib/components/Cards/ServiceCard.svelte';
    import ConfirmOrderModal from '$lib/components/Modals/ConfirmOrderModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
    import { ServiceEvent, ServiceStatus } from '$lib/events/ServiceEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { toaster } from '$lib/stores/toaster';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import {
        NDKRelay,
        NDKSubscription,
        type NDKFilter,
        NDKKind,
        NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy, onMount } from 'svelte';

    enum OrderTab {
        Pending,
        InProgress,
        Completed,
    }

    const serviceSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
    };

    const ordersSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
        autoStart: false,
    };

    const myOrdersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOrder],
    };

    const allOrdersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOrder],
    };

    const myOrdersStore = $ndk.storeSubscribe<OrderEvent>(
        myOrdersFilter,
        ordersSubOptions,
        OrderEvent
    );
    const allOrdersStore = $ndk.storeSubscribe<OrderEvent>(
        allOrdersFilter,
        ordersSubOptions,
        OrderEvent
    );

    let alreadySubscribedToOrders = $state(false);

    // Component state
    let serviceSubscription = $state<NDKSubscription>();
    let service = $state<ServiceEvent>();

    let displayOrderConfirmationModal = $state(false);
    let showLoginModal = $state(false);

    const myService = $derived(
        !!$currentUser && !!service && $currentUser.pubkey === service.pubkey
    );

    const wotFilteredOrders = $derived.by(() => {
        if (!$allOrdersStore) return [];

        let orders: OrderEvent[] = [...$allOrdersStore];

        // Filtering out bids not in the web of Trust
        orders = orders.filter((order: OrderEvent) => {
            return $wot.has(order.pubkey);
        });
        orderEventsChronologically(orders);

        return orders;
    });

    const { pendingOrders, inProgressOrders, completedOrders } = $derived.by(() => {
        const pending: OrderEvent[] = [];
        const inProgress: OrderEvent[] = [];
        const completed: OrderEvent[] = [];

        if (wotFilteredOrders.length && service) {
            // loop over all wot filtered orders
            wotFilteredOrders.forEach((order) => {
                if (order.status === OrderStatus.Open) {
                    if (service!.orders.includes(order.orderAddress)) {
                        // if order status is open and service has reference of this order
                        // then consider it in-progress
                        inProgress.push(order);
                    } else {
                        // if order status is open and service does not have reference of this order
                        // then consider it pending
                        pending.push(order);
                    }
                } else {
                    // when order status is not open, consider it completed(either fulfilled or failed)
                    completed.push(order);
                }
            });
        }

        return {
            pendingOrders: pending,
            inProgressOrders: inProgress,
            completedOrders: completed,
        };
    });

    const { btnActionText, allowMakeOrder, disallowMakeOrderReason } = $derived.by(() => {
        if (!service)
            return {
                allowMakeOrder: false,
                disallowMakeOrderReason: '',
            };

        let btnActionText = 'Order';

        // check if user has already made an order
        if ($myOrdersStore.length) {
            btnActionText = 'Order Again';
        }

        // check if order is already in progress
        if ($myOrdersStore.some((order) => order.status === OrderStatus.Open)) {
            return {
                allowMakeOrder: false,
                disallowMakeOrderReason: 'An order is already in progress',
            };
        }

        if (service.status === ServiceStatus.InActive) {
            return {
                allowMakeOrder: false,
                disallowMakeOrderReason: 'Service is not active!',
            };
        }

        return {
            allowMakeOrder: true,
            btnActionText,
            disallowMakeOrderReason: '',
        };
    });

    let initialized = $state(false);
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            checkRelayConnections();

            const naddr = page.params.serviceId;
            const relaysFromURL = relaysFromNaddr(naddr).split(',');

            // Add relays from URL
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                }
            });

            // Subscribe to job events
            const dTag = idFromNaddr(naddr).split(':')[2];
            const serviceFilter: NDKFilter = {
                kinds: [NDKKind.FreelanceService],
                '#d': [dTag],
            };

            serviceSubscription = $ndk.subscribe(serviceFilter, serviceSubOptions);
            serviceSubscription.on('event', handleServiceEvent);
        }
    });

    function handleServiceEvent(event: NDKEvent) {
        const arrivedService = ServiceEvent.from(event);

        if ($currentUser && arrivedService && !alreadySubscribedToOrders) {
            alreadySubscribedToOrders = true;

            // when current user is not service owner, subscribe for current user's orders on this service
            if ($currentUser.pubkey !== arrivedService.pubkey) {
                myOrdersFilter['#a'] = [arrivedService.serviceAddress];
                myOrdersFilter.authors = [$currentUser.pubkey];
                myOrdersStore.startSubscription();
            }

            // subscribe for all orders on the service
            allOrdersFilter['#a'] = [arrivedService.serviceAddress];
            allOrdersStore.startSubscription();
        }

        // Skip older jobs
        if (service && arrivedService.created_at! < service.created_at!) {
            return;
        }

        service = arrivedService;
    }

    let pageTop = $state<HTMLDivElement>();

    onMount(() => {
        if (pageTop) {
            pageTop.scrollIntoView(true);
        }
    });

    onDestroy(() => {
        serviceSubscription?.stop();
    });

    function triggerLogin() {
        showLoginModal = true;
    }

    async function confirmOrder(note: string) {
        if (!service) return;

        const orderEvent = new OrderEvent($ndk);
        orderEvent.description = note;
        orderEvent.status = OrderStatus.Open;
        orderEvent.referencedServiceAddress = service!.serviceAddress;
        orderEvent.pricing = service.pricing;
        orderEvent.amount = service.amount;
        orderEvent.setPledgeSplit(service.pledgeSplit, service.pubkey);
        orderEvent.generateTags(); // this generates d-tag

        try {
            await orderEvent.publish();
            toaster.success({
                title: 'Order placed',
            });
        } catch (error) {
            console.error(error);
            toaster.error({
                title: `Failed to place the order. ${error}`,
            });
        }
    }

    let selectedOrdersTab = $state(OrderTab.Pending);

    const tabs = [
        { id: OrderTab.Pending, label: 'Pending' },
        { id: OrderTab.InProgress, label: 'In-Progress' },
        { id: OrderTab.Completed, label: 'Completed' },
    ];
</script>

<div bind:this={pageTop} class="w-full flex flex-col gap-0 grow pb-20 sm:pb-5">
    <div class="w-full flex flex-col justify-center items-center">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                {#if service}
                    <div class="w-full flex flex-col gap-[15px]">
                        <ServiceCard {service} allOrders={wotFilteredOrders} />
                        <div class="flex flex-row justify-center">
                            {#if !myService}
                                {#if allowMakeOrder}
                                    {#if $loggedIn}
                                        <div class="flex flex-row justify-center">
                                            {#if btnActionText}
                                                <Button
                                                    onClick={() =>
                                                        (displayOrderConfirmationModal = true)}
                                                    classes="max-[768px]:grow-1"
                                                >
                                                    {btnActionText}
                                                </Button>
                                            {/if}
                                        </div>
                                    {:else}
                                        <div class="flex flex-row justify-center">
                                            <Button
                                                onClick={triggerLogin}
                                                classes="max-[768px]:grow-1"
                                            >
                                                Login to make bid
                                            </Button>
                                        </div>
                                    {/if}
                                {:else}
                                    <div
                                        class="w-full min-h-[100px] rounded-[8px] bg-black-100 dark:bg-white-100 border-[4px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                                    >
                                        <p
                                            class="font-[600] text-[18px] text-black-300 dark:text-white-300"
                                        >
                                            {disallowMakeOrderReason}
                                        </p>
                                    </div>
                                {/if}
                            {:else}
                                <!-- UI for displaying orders -->
                                <div class="w-full flex flex-col gap-[15px]">
                                    <div
                                        class="w-full flex flex-row flex-wrap gap-[10px] justify-between items-center"
                                    >
                                        <p
                                            class="font-[600] text-[24px] flex flex-row gap-[5px] items-center"
                                        >
                                            Orders
                                            <span class="font-[400] text-[16px]"
                                                >({insertThousandSeparator(
                                                    wotFilteredOrders.length
                                                )})</span
                                            >
                                        </p>
                                    </div>

                                    <!-- tabs start-->
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <TabSelector {tabs} bind:selectedTab={selectedOrdersTab} />
                                        <!-- tabs content start-->
                                        <div class="w-full flex flex-col">
                                            {#if selectedOrdersTab === OrderTab.Pending}
                                                <div class="w-full flex flex-col">
                                                    <div class="w-full flex flex-col gap-[15px]">
                                                        {#each pendingOrders as order}
                                                            <OrderCard {order} />
                                                        {/each}
                                                    </div>
                                                </div>
                                            {:else if selectedOrdersTab === OrderTab.InProgress}
                                                <div class="w-full flex flex-col">
                                                    <div class="w-full flex flex-col gap-[15px]">
                                                        {#each inProgressOrders as order}
                                                            <OrderCard {order} />
                                                        {/each}
                                                    </div>
                                                </div>
                                            {:else}
                                                <div class="w-full flex flex-col">
                                                    <div class="w-full flex flex-col gap-[15px]">
                                                        {#each completedOrders as order}
                                                            <OrderCard {order} />
                                                        {/each}
                                                    </div>
                                                </div>
                                            {/if}
                                        </div>
                                        <!-- tabs content end -->
                                    </div>
                                    <!-- tabs end-->
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="w-[90vw] p-4 space-y-4">
                        <div class="sm:grid sm:grid-cols-[70%_1fr] sm:gap-x-4">
                            <div class="space-y-6">
                                <div class="w-full h-[50vh] card p-8 flex justify-center">
                                    <div class="w-[50%] card placeholder animate-pulse"></div>
                                </div>
                                <div class="w-full h-[20vh] card p-8 flex justify-center">
                                    <div class="w-[50%] card placeholder animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

{#if service}
    <ConfirmOrderModal
        bind:isOpen={displayOrderConfirmationModal}
        {service}
        onConfirm={confirmOrder}
    />
{/if}
