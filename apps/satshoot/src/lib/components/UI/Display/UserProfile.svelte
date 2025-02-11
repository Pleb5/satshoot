<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import {
        NDKSubscriptionCacheUsage,
        type Hexpubkey,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import { onMount } from 'svelte';
    import ProfileImage from './ProfileImage.svelte';

    export let pubkey: Hexpubkey;

    $: npub = nip19.npubEncode(pubkey);
    $: avatarImage = `https://robohash.org/${npub}`;
    $: profileLink = '/' + npub;

    let userProfile: NDKUserProfile | undefined = undefined;

    $: if (userProfile?.image) {
        avatarImage = userProfile.image;
    }

    onMount(async () => {
        const user = $ndk.getUser({ pubkey });

        const profile = await user.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: true,
            groupable: true,
            groupableDelay: 1000,
        });
        if (profile) {
            userProfile = profile;
        }
    });
</script>

<div class="w-full flex flex-row gap-[20px] p-[5px]">
    <div class="flex flex-col">
        <a href={profileLink}>
            <ProfileImage src={avatarImage} />
        </a>
    </div>
    <div class="flex flex-col">
        <a href={profileLink} class="font-[600]">
            {userProfile?.name ??
                userProfile?.displayName ??
                shortenTextWithEllipsesInMiddle(npub, 15)}
        </a>
        {#if userProfile?.nip05}
            <a href={profileLink} class=""> {userProfile.nip05} </a>
        {/if}
    </div>
</div>
