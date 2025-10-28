<script lang="ts">
    import ndk from '$lib/stores/session';
    import type { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { page } from '$app/state';
    import Fuse from 'fuse.js';

    interface Props {
        notification: NDKEvent;
    }

    let { notification }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    const follower = $state($ndk.getUser({ pubkey: notification.pubkey }));
    let followerName = $state(follower.npub.substring(0, 8));
    let followerImage = $state(getRoboHashPicture(follower.pubkey));
    let followerProfile = $state<NDKUserProfile | null>(null);

    onMount(async () => {
        followerProfile = await follower.fetchProfile();
        if (followerProfile) {
            if (followerProfile.name) {
                followerName = followerProfile.name;
            }
            if (followerProfile.picture) {
                followerImage = followerProfile.picture;
            }
        }
    });

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: follower.npub,
                    name: followerProfile?.name || followerName,
                    displayName: followerProfile?.displayName || '',
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

<Card
    {classes}
    actAsButton
    onClick={() => {
        if (!$readNotifications.has(notification.id)) {
            readNotifications.update((notifications) => notifications.add(notification.id));
        }
    }}
>
    <NotificationTimestamp ndkEvent={notification} />
    <a href={'/' + follower.npub} class="flex flex-row items-center gap-[10px] w-full">
        <div class="shrink-0">
            <ProfileImage src={followerImage} />
        </div>
        <div class="flex-1 min-w-0 flex flex-col gap-[0px]">
            <p class="truncate max-w-full">{followerName}</p>
            <p>has followed you</p>
        </div>
    </a>
</Card>
