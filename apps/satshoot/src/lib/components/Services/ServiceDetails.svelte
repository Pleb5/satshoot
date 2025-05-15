<script lang="ts">
    import {
        NDKSubscriptionCacheUsage,
        type Hexpubkey,
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
    import QuestionIcon from '../Icons/QuestionIcon.svelte';

    interface Props {
        service: ServiceEvent;
    }

    let { service }: Props = $props();

    // Derived values
    const npub = $derived(nip19.npubEncode(service.pubkey));
    const avatarImage = $derived(getRoboHashPicture(service.pubkey));
    const profileLink = $derived('/' + npub);

    // Reactive state
    let userProfile = $state<NDKUserProfile | null>(null);

    const pricing = $derived.by(() => {
        if (service.pricing === Pricing.Absolute) return 'sats';
        if (service.pricing === Pricing.SatsPerMin) return 'sats/min';

        return '';
    });

    const ordersCount = $derived.by(() => {
        let count = 0;

        service.orders.filter((orderAddress) => {
            const pubkey = orderAddress.split(':')[1];
            if (pubkey && $wot.has(pubkey)) count++;
        });

        return count;
    });

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
            <ReputationCard user={service.pubkey} type={ReviewType.Freelancer} />
        </div>
    </div>
    <div class="grow-1">
        <p class="font-[500]">
            Service cost:
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
            <QuestionIcon
                extraClasses="text-[14px] p-[3px]"
                placement="bottom-start"
                popUpText="Number of times service was taken by logged in user's WOT."
            />
            <span>Orders: </span>
            <span class="font-[300]">{ordersCount}</span>
        </p>
    </div>
</div>
