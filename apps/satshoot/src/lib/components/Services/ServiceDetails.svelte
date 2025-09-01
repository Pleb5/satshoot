<script lang="ts">
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type NDKFilter,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import ndk from '$lib/stores/session';
    import { nip19 } from 'nostr-tools';
    import { getRoboHashPicture, shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import ReputationCard from '../Cards/ReputationCard.svelte';
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { Pricing } from '$lib/events/types';
    import { wot } from '$lib/stores/wot';
    import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
    import currentUser from '$lib/stores/user';
    import Button from '../UI/Buttons/Button.svelte';
    import OrdersCountBreakdown from '../Modals/OrdersCountBreakdown.svelte';
    import { getPubkeyFromNpubOrNprofile } from '$lib/utils/nip19';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';

    interface Props {
        service: ServiceEvent;
    }

    let { service }: Props = $props();
    let showOrderPriceBreakdownModal = $state(false);

    const allOrdersFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceOrder],
    };

    const allOrdersStore = $ndk.storeSubscribe<OrderEvent>(
        allOrdersFilter,
        {
            closeOnEose: false,
            autoStart: false,
        },
        OrderEvent
    );

    let alreadySubscribedToOrders = $state(false);

    // Derived values
    const npub = $derived(nip19.npubEncode(service.pubkey));
    const avatarImage = $derived(getRoboHashPicture(service.pubkey));
    const profileLink = $derived('/' + npub);

    // Reactive state
    let userProfile = $state<NDKUserProfile | null>(null);

    const pricing = $derived.by(() => {
        if (service.pricing === Pricing.Absolute) return 'sats';
        if (service.pricing === Pricing.Hourly) return 'sats/hour';

        return '';
    });

    const fulfilledOrders = $derived(
        $allOrdersStore.filter(
            (order) =>
                $wot.has(order.pubkey) &&
                service.orders.includes(order.orderAddress) &&
                order.status === OrderStatus.Fulfilled
        )
    );

    const sponsoredPubkey = getPubkeyFromNpubOrNprofile(service.sponsoredNpub);

    // Effect to fetch user profile
    $effect(() => {
        const ndkUser = $ndk.getUser({ pubkey: service.pubkey });
        ndkUser
            .fetchProfile({
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                closeOnEose: true,
                groupable: true,
                groupableDelay: 1000,
            })
            .then((profile) => {
                userProfile = profile;
            });
    });

    $effect(() => {
        if ($currentUser && !alreadySubscribedToOrders) {
            alreadySubscribedToOrders = true;

            allOrdersFilter['#a'] = [service.serviceAddress];
            allOrdersStore.startSubscription();
        }
    });
</script>

<div class="grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-row gap-[5px]">
        <div
            class="flex flex-row p-[0_8px_0_0] m-[0_5px_0_0] border-r border-black-100 dark:border-white-100 dark:border-r-white-100"
        >
            <a
                class="transition ease-in-out duration-[0.3s] flex flex-col justify-center items-center"
                href={profileLink}
            >
                <ProfileImage src={userProfile?.picture || avatarImage} />
            </a>
        </div>
        <div class="w-full flex flex-col gap-[5px]">
            <a href={profileLink} class="font-[600] line-clamp-1 overflow-hidden max-w-[200px]">
                {userProfile?.name ??
                    userProfile?.displayName ??
                    shortenTextWithEllipsesInMiddle(npub, 15)}
            </a>
            <ReputationCard
                user={service.pubkey}
                type={ReviewType.Freelancer}
                serviceAddress={service.serviceAddress}
            />
        </div>
    </div>
    <div class="grow-1">
        <p class="font-[500]">
            Price:
            <span class="font-[300]">
                {insertThousandSeparator(service.amount) + ' ' + pricing}
            </span>
        </p>
    </div>
    <div class="grow-1">
        <p class="font-[500]">
            Pledge split:
            <span class="font-[300]"> {service.pledgeSplit + ' %'} </span>
        </p>
    </div>
    <div class="grow-1">
        <p class="font-[500]">
            Sponsoring split:
            <span class="font-[300]"> {service.sponsoringSplit + ' %'} </span>
        </p>
    </div>
    <div class="grow-1">
        <Button
            variant="outlined"
            classes="outline-yellow-500 dark:outline-yellow-600"
            onClick={() => (showOrderPriceBreakdownModal = true)}
        >
            <span>Orders: </span>
            <span class="font-[300]">{fulfilledOrders.length}</span>
        </Button>
    </div>
</div>

<OrdersCountBreakdown bind:isOpen={showOrderPriceBreakdownModal} {fulfilledOrders} />
