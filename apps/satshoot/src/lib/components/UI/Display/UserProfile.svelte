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

    export let pubkey: Hexpubkey;

    $: npub = nip19.npubEncode(pubkey);
    $: avatarImage = `https://robohash.org/${npub}`;
    $: profileLink = '/' + npub;

    let userProfile: NDKUserProfile | undefined = undefined;

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

    const profileLinkClasses =
        'transition transition-ease duration-[0.3s] transform w-[55px] h-[55px] min-w-[55px] min-h-[55px] ' +
        'overflow-hidden relative rounded-[100%] shadow-[0_0_4px_4px_rgba(0,0,0,0.5)] bg-[rgb(0,0,0,0.1)] ' +
        'outline outline-[4px] outline-[rgb(255,255,255)] hover:outline-[rgb(59,115,246)] hover:scale-[1.02]';
</script>

<div class="w-full flex flex-row gap-[20px] p-[5px]">
    <div class="flex flex-col">
        <a href={profileLink} class={profileLinkClasses}>
            <img class="w-full h-full absolute inset-0 object-cover" src={avatarImage} alt="" />
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
