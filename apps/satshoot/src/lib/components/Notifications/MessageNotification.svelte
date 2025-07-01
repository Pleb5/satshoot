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
    import { page } from '$app/state';
    import Fuse from 'fuse.js';

    interface Props {
        notification: NDKEvent;
    }

    let { notification }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    let user = $state($ndk.getUser({ pubkey: notification.pubkey }));
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));

    let userProfile: NDKUserProfile | null;
    let decryptedDM = $state<string>();
    let messageLink = $state('');
    const eventAddress = notification.tagValue('a');

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
            decryptedDM = decryptedDM
                .split('\n')
                .filter((line) => !line.startsWith('Reply to this message in SatShoot'))
                .join('\n');
        } catch (e) {
            console.trace(e);
        }

        if (eventAddress) {
            const event = await $ndk.fetchEvent(eventAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            if (event) {
                messageLink = '/messages/' + event.encode();
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

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: user.npub,
                    name: userProfile?.name || userName,
                    displayName: userProfile?.displayName || '',
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
                        weight: 0.4,
                    },
                    {
                        name: 'name',
                        weight: 0.3,
                    },
                    {
                        name: 'displayName',
                        weight: 0.3,
                    },
                ],
            });
            const searchResult = fuse.search(searchQuery);
            return searchResult.length > 0;
        }

        return true;
    });

    const classes = $derived.by(() => {
        let classes = $readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold';
        if (!display) {
            classes += ' hidden';
        }

        return classes;
    });
</script>

<Card {classes} actAsButton onClick={goToChat}>
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
