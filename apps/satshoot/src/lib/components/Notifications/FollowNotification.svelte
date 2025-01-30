<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import type { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';

    export let followEvent: NDKEvent;

    const follower = $ndk.getUser({ pubkey: followEvent.pubkey });
    let followerName = follower.npub.substring(0, 8);
    let followerImage = `https://robohash.org/${follower.pubkey}`;
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
    classes={$readNotifications.has(followEvent.id) ? 'bg-[rgb(0,0,0,0.05)]' : ''}
    actAsButton
    on:click={() => {
        readNotifications.update((notifications) => notifications.add(followEvent.id));
    }}
>
    <NotificationTimestamp ndkEvent={followEvent} />
    <a href={'/' + follower.npub} class="flex flex-row items-center gap-[10px]">
        <ProfileImage src={followerImage} />
        <div class="flex flex-col gap-[0px]">
            <p class="font-bold text-sm md:text-lg">{followerName}</p>
            <p>has followed you</p>
        </div>
    </a>
</Card>
