<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import type { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';

    export let notification: NDKEvent;

    const follower = $ndk.getUser({ pubkey: notification.pubkey });
    let followerName = follower.npub.substring(0, 8);
    let followerImage = getRoboHashPicture(follower.pubkey);
    let followerProfile: NDKUserProfile | null;

    onMount(async () => {
        followerProfile = await follower.fetchProfile();
        if (followerProfile) {
            if (followerProfile.name) {
                followerName = followerProfile.name;
            }
            if (followerProfile.image) {
                followerImage = followerProfile.image;
            }
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
    }}
>
    <NotificationTimestamp ndkEvent={notification} />
    <a href={'/' + follower.npub} class="flex flex-row items-center gap-[10px]">
        <ProfileImage src={followerImage} />
        <div class="flex flex-col gap-[0px]">
            <p>{followerName}</p>
            <p>has followed you</p>
        </div>
    </a>
</Card>
