<script lang="ts">
    import {
        NDKSubscriptionCacheUsage,
        type NDKEvent,
        type NDKSigner,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import Card from '../UI/Card.svelte';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import ndk from '$lib/stores/ndk';
    import { onMount } from 'svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import currentUser from '$lib/stores/user';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import NotificationTimestamp from './NotificationTimestamp.svelte';

    export let message: NDKEvent;

    $: user = $ndk.getUser({ pubkey: message.pubkey });
    $: userName = user.npub.substring(0, 8);
    $: userImage = `https://robohash.org/${user.pubkey}`;

    let userProfile: NDKUserProfile | null;
    let decryptedDM: string;
    let messageLink = '';
    const ticketAddress = message.tagValue('t');

    onMount(async () => {
        userProfile = await user.fetchProfile();
        if (userProfile) {
            if (userProfile.name) {
                userName = userProfile.name;
            }
            if (userProfile.image) {
                userImage = userProfile.image;
            }
        }

        try {
            const peerPubkey =
                message.tagValue('p') === $currentUser!.pubkey
                    ? message.pubkey
                    : message.tagValue('p');

            const peerUser = $ndk.getUser({ pubkey: peerPubkey });
            decryptedDM = await ($ndk.signer as NDKSigner).decrypt(peerUser, message.content);
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

<Card>
    <NotificationTimestamp ndkEvent={message} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col">
            <a href={'/' + user.npub}>
                <p>{userName}</p>
            </a>
            <div class="flex flex-row gap-[5px] flex-wrap">
                <a href={messageLink}>
                    {decryptedDM.slice(0, 90)}{decryptedDM.length > 90 ? '...' : ''}
                </a>
            </div>
        </div>
    </div>
</Card>
