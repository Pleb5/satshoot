<script lang="ts">
    import ndk, { sessionInitialized } from '$lib/stores/session';

    import { onDestroy, onMount } from 'svelte';

    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { OrderStatus, type OrderEvent } from '$lib/events/OrderEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import currentUser from '$lib/stores/user';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import { page } from '$app/state';
    import Fuse from 'fuse.js';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';
    interface Props {
        notification: OrderEvent;
    }

    let { notification: order }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    let orderPublisher = $ndk.getUser({ pubkey: order.pubkey });
    let orderPublisherName = $state(orderPublisher.npub.substring(0, 8));
    let orderPublisherImage = $state(getRoboHashPicture(orderPublisher.pubkey));

    let servicePublisher = $ndk.getUser({
        pubkey: order.referencedServiceAddress.split(':')[1],
    });
    let servicePublisherName = $state(servicePublisher.npub.substring(0, 8));
    let servicePublisherImage = $state(getRoboHashPicture(servicePublisher.pubkey));

    const serviceFilter = {
        kinds: [ExtendedNDKKind.FreelanceService],
        '#d': [order.referencedServiceAddress.split(':')[2]],
    };

    const serviceStore = $ndk.storeSubscribe<ServiceEvent>(
        serviceFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        ServiceEvent
    );

    const service = $derived.by(() => {
        if ($serviceStore.length > 0) {
            return $serviceStore[0];
        }

        return null;
    });

    const myOrder = $derived(order.pubkey === $currentUser?.pubkey);

    const myService = $derived(!!$currentUser && service?.pubkey === $currentUser?.pubkey);

    const { user, userName, userImage } = $derived.by(() => {
        const returnObj = {
            user: null,
            userName: '',
            userImage: '',
        };

        if (!service) return returnObj;

        if (myOrder) {
            return {
                user: servicePublisher,
                userName: servicePublisherName,
                userImage: servicePublisherImage,
            };
        }

        if (myService) {
            return {
                user: orderPublisher,
                userName: orderPublisherName,
                userImage: orderPublisherImage,
            };
        }

        return returnObj;
    });

    const orderState = $derived.by(() => {
        if (!service) return;

        if (myOrder) {
            // I placed the order
            if (order.status === OrderStatus.Open && service.orders.includes(order.orderAddress)) {
                return 'Order Accepted';
            }
            if (order.status === OrderStatus.Open && !service.orders.includes(order.orderAddress)) {
                return 'Order Pending';
            }
            if (order.status !== OrderStatus.Open) {
                return 'Order Closed';
            }
        } else if (myService) {
            // Someone placed an order on my service
            if (order.status === OrderStatus.Open && !service.orders.includes(order.orderAddress)) {
                return 'Order Placed';
            }
            if (order.status === OrderStatus.Open && service.orders.includes(order.orderAddress)) {
                return 'Order In Progress';
            }
            if (order.status !== OrderStatus.Open) {
                return 'Order Closed';
            }
        }
    });

    let initialized = $state(false);

    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            serviceStore.startSubscription();
        }
    });

    onMount(async () => {
        const orderPublisherProfile = await orderPublisher.fetchProfile();
        if (orderPublisherProfile) {
            if (orderPublisherProfile.name) {
                orderPublisherName = orderPublisherProfile.name;
            }
            if (orderPublisherProfile.picture) {
                orderPublisherImage = orderPublisherProfile.picture;
            }
        }

        const servicePublisherProfile = await servicePublisher.fetchProfile();
        if (servicePublisherProfile) {
            if (servicePublisherProfile.name) {
                servicePublisherName = servicePublisherProfile.name;
            }
            if (servicePublisherProfile.picture) {
                servicePublisherImage = servicePublisherProfile.picture;
            }
        }
    });

    onDestroy(() => {
        if (serviceStore) serviceStore.empty();
    });

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: user?.npub,
                    name: userName,
                    service: service?.title,
                },
            ];

            const fuse = new Fuse(dataToSearch, {
                isCaseSensitive: false,
                ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
                threshold: 0.6,
                minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
                keys: [
                    {
                        name: 'npub',
                        weight: 0.3,
                    },
                    {
                        name: 'name',
                        weight: 0.3,
                    },
                    {
                        name: 'service',
                        weight: 0.4,
                    },
                ],
            });
            const searchResult = fuse.search(searchQuery);
            return searchResult.length > 0;
        }

        return true;
    });

    const classes = $derived.by(() => {
        let classes = $readNotifications.has(order.id) ? 'bg-black-50' : 'font-bold';
        if (!display) {
            classes += ' hidden';
        }

        return classes;
    });

    const getOrderTimeline = (
        orderEvent: OrderEvent,
        serviceEvent: ServiceEvent
    ): Array<{ label: string; timestamp: number; color: string }> => {
        const timeline: Array<{ label: string; timestamp: number; color: string }> = [];

        // Find if this order is in the service's accepted orders
        const orderTag = serviceEvent.tags.find(
            (tag) => tag[0] === 'a' && tag[1] === orderEvent.orderAddress
        );
        const isAccepted = !!orderTag;

        // Find acceptance timestamp from service tag
        const acceptanceTimestamp = orderTag && orderTag[2] ? parseInt(orderTag[2]) : null;

        // Add order acceptance entry if order was accepted
        if (isAccepted && acceptanceTimestamp) {
            timeline.push({
                label: 'Order Accepted',
                timestamp: acceptanceTimestamp,
                color: 'bg-yellow-500',
            });
        }

        // Add order completion/failure from state history
        const completionEntry = orderEvent.stateHistory.find(
            (entry) =>
                entry.toStatus === OrderStatus.Fulfilled || entry.toStatus === OrderStatus.Failed
        );

        if (completionEntry) {
            const label =
                completionEntry.toStatus === OrderStatus.Fulfilled
                    ? 'Order Fulfilled'
                    : 'Order Failed';
            const color =
                completionEntry.toStatus === OrderStatus.Fulfilled ? 'bg-green-600' : 'bg-red-600';

            timeline.push({
                label,
                timestamp: completionEntry.timestamp,
                color,
            });
        }

        return timeline.sort((a, b) => a.timestamp - b.timestamp);
    };
</script>

<Card
    {classes}
    actAsButton
    onClick={() => {
        if (!$readNotifications.has(order.id)) {
            readNotifications.update((notifications) => notifications.add(order.id));
        }
    }}
>
    <NotificationTimestamp ndkEvent={order} />
    {#if service && user && orderState}
        <div class="w-full flex flex-row gap-[15px]">
            <a href={'/' + user.npub} class="shrink-0">
                <ProfileImage src={userImage} />
            </a>
            <div class="flex-1 min-w-0 flex flex-col items-start">
                <a href={'/' + user.npub}>
                    <p class="truncate max-w-full">{userName}</p>
                </a>
                <div class="flex flex-row gap-[5px] flex-wrap w-full">
                    {#if orderState === 'Order Placed'}
                        <p>Has placed an order on:</p>
                    {:else if orderState === 'Order Pending'}
                        <p>Your order is pending on:</p>
                    {:else if orderState === 'Order Accepted'}
                        <p>Has accepted your order on:</p>
                    {:else if orderState === 'Order In Progress'}
                        <p>Order in progress on:</p>
                    {:else if orderState === 'Order Closed'}
                        <p>Has closed order on:</p>
                    {/if}
                    <a
                        href={'/' + service.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] link break-words"
                    >
                        "{service.title}"
                    </a>
                </div>

                <!-- Order Status Timestamps -->
                <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1 w-full">
                    <!-- Order Creation -->
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 shrink-0 rounded-full bg-blue-500"></span>
                        <span class="break-words">
                            Order Placed: {new Date(
                                (order.publishedAt || 0) * 1000
                            ).toLocaleString()}
                        </span>
                    </div>

                    <!-- Order Timeline -->
                    {#each getOrderTimeline(order, service) as timelineEntry}
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 shrink-0 rounded-full {timelineEntry.color}"
                            ></span>
                            <span class="break-words">
                                {timelineEntry.label}: {new Date(
                                    timelineEntry.timestamp * 1000
                                ).toLocaleString()}
                            </span>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {:else}
        <ProgressRing color="primary" />
    {/if}
</Card>
