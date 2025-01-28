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
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { onMount } from 'svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
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
            {#if decryptedDM}
                <div class="flex flex-row gap-[5px] flex-wrap">
                    <a href={messageLink}>
                        {decryptedDM.slice(0, 90)}{decryptedDM.length > 90 ? '...' : ''}
                    </a>
                </div>
            {:else}
                <ProgressRadial
                    value={undefined}
                    stroke={60}
                    meter="stroke-primary-500"
                    track="stroke-primary-500/30"
                    strokeLinecap="round"
                    width="w-8"
                />
            {/if}
        </div>
    </div>
</Card>
