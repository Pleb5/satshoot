<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import type { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { Avatar } from '@skeletonlabs/skeleton';
    import { onMount } from 'svelte';

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

<div class="flex">
    <div class="card p-4 flex items-center space-x-4 bg-surface-300-600-token rounded-tl-none">
        <a href={'/' + follower.npub} class="flex items-center space-x-4">
            <Avatar src={followerImage} width="w-12" />
            <div>
                <p class="font-bold text-sm md:text-lg">{followerName}</p>
                <p>has followed you</p>
            </div>
        </a>
    </div>
</div>
