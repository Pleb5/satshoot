<script lang="ts">
    import { TicketEvent } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
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
    const ticketAddress = notification.tagValue('t');

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

        if (ticketAddress) {
            const event = await $ndk.fetchEvent(ticketAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });
            if (event) {
                const ticketEvent = TicketEvent.from(event);
                messageLink = '/messages/' + ticketEvent.encode();
            }
            console.log('message link', messageLink);
        }
    });
</script>

<Card
    classes={$readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold'}
    actAsButton
    on:click={() => {
        if (!$readNotifications.has(notification.id)) {
            readNotifications.update((notifications) => notifications.add(notification.id));
        }
        goto(messageLink);
    }}
>
    <NotificationTimestamp ndkEvent={notification} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col">
            <a href={'/' + user.npub}>
                <p>{userName}</p>
            </a>
            {#if decryptedDM}
                <div class="flex flex-row gap-[5px] flex-wrap">
                    <a href={messageLink}>
                        {decryptedDM.slice(0, 90)}{decryptedDM.length > 90 ? '...' : ''}
                    </a>
                </div>
            {:else}
                <ProgressRing color="primary" />
            {/if}
        </div>
    </div>
</Card>
