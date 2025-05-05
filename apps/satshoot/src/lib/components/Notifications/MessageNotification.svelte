<script lang="ts">
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import {
        NDKSubscriptionCacheUsage,
        type NDKEvent,
        type NDKSigner,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { goto } from '$app/navigation';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';

    interface Props {
        notification: NDKEvent;
    }

    let { notification }: Props = $props();

    let user = $ndk.getUser({ pubkey: notification.pubkey });
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));

    let userProfile: NDKUserProfile | null;
    let decryptedDM = $state<string>();
    let messageLink = $state('');
    const jobAddress = notification.tagValue('t');

    onMount(async () => {
        userProfile = await user.fetchProfile();
        if (userProfile) {
            if (userProfile.name) {
                userName = userProfile.name;
            }
            if (userProfile.picture) {
                userImage = userProfile.picture;
            }
        }

        try {
            const peerPubkey =
                notification.tagValue('p') === $currentUser!.pubkey
                    ? notification.pubkey
                    : notification.tagValue('p');

            const peerUser = $ndk.getUser({ pubkey: peerPubkey });
            decryptedDM = await ($ndk.signer as NDKSigner).decrypt(peerUser, notification.content);
        } catch (e) {
            console.trace(e);
        }

        if (jobAddress) {
            const event = await $ndk.fetchEvent(jobAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });
            if (event) {
                const jobEvent = JobEvent.from(event);
                messageLink = '/messages/' + jobEvent.encode();
            }
        }
    });

    const goToChat = () => {
        if (!$readNotifications.has(notification.id)) {
            console.log('putting this notif into read ones...', notification.id);
            readNotifications.update((notifications) => notifications.add(notification.id));
        }
        if (!messageLink)
            throw new Error('Error: Message link undefined, trying to navigate to undefined URL!');
        const url = new URL(messageLink, window.location.origin);
        url.searchParams.append(SELECTED_QUERY_PARAM, notification.pubkey);
        goto(url);
    };
</script>

<Card
    classes={$readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold'}
    actAsButton
    onClick={goToChat}
>
    <NotificationTimestamp ndkEvent={notification} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col">
            <p>{userName}</p>
            {#if decryptedDM}
                <div class="flex flex-row gap-[5px] flex-wrap">
                    {decryptedDM.slice(0, 90)}{decryptedDM.length > 90 ? '...' : ''}
                </div>
            {:else}
                <ProgressRing color="primary" />
            {/if}
        </div>
    </div>
</Card>
