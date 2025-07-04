<script lang="ts">
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { NDKKind, type NDKFilter, type NDKUserProfile } from '@nostr-dev-kit/ndk';

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

    const serviceFilter: NDKFilter<NDKKind.FreelanceService> = {
        kinds: [NDKKind.FreelanceService],
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
            if (order.status === OrderStatus.Open && service.orders.includes(order.orderAddress)) {
                return 'Order Accepted';
            }
        } else if (myService) {
            if (order.status === OrderStatus.Open && !service.orders.includes(order.orderAddress)) {
                return 'Order Placed';
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
            <a href={'/' + user.npub}>
                <ProfileImage src={userImage} />
            </a>
            <div class="flex flex-col items-start">
                <a href={'/' + user.npub}>
                    <p>{userName}</p>
                </a>
                <div class="flex flex-row gap-[5px] flex-wrap">
                    {#if orderState === 'Order Placed'}
                        <p>Has placed an order on:</p>
                    {:else if orderState === 'Order Accepted'}
                        <p>Has accepted your order on:</p>
                    {:else if orderState === 'Order Closed'}
                        <p>Has closed order on:</p>
                    {/if}
                    <a
                        href={'/' + service.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] link"
                    >
                        "{service.title}"
                    </a>
                </div>
            </div>
        </div>
    {:else}
        <ProgressRing color="primary" />
    {/if}
</Card>
