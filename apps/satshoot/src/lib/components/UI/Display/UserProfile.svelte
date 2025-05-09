<script lang="ts">
    import ndk from '$lib/stores/session';
    import { getRoboHashPicture, shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import {
        NDKSubscriptionCacheUsage,
        type Hexpubkey,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import { onMount } from 'svelte';
    import ProfileImage from './ProfileImage.svelte';

    interface Props {
        pubkey: Hexpubkey;
    }

    let { pubkey }: Props = $props();

    let npub = $derived(nip19.npubEncode(pubkey));
    let profileLink = $derived('/' + npub);

    let userProfile = $state<NDKUserProfile | null>(null);
    let avatarImage = $derived(
        userProfile?.picture ?? getRoboHashPicture(pubkey)
    );

    onMount(async () => {
        const user = $ndk.getUser({ pubkey });

        userProfile = await user.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: true,
            groupable: true,
            groupableDelay: 1000,
        });
    });
</script>

<div class="w-full flex flex-row gap-[20px] p-[5px]">
    <div class="flex flex-col">
        <a href={profileLink}>
            <ProfileImage src={avatarImage} />
        </a>
    </div>
    <div class="flex flex-col">
        <div class="grid grid-cols-1">
            <a href={profileLink} class="font-[600]">
                {
                    userProfile?.name ??
                    userProfile?.displayName ??
                    shortenTextWithEllipsesInMiddle(npub, 15)
                }
            </a>
        </div>
        <div class="grid grid-cols-1">
            {#if userProfile?.nip05}
                <a href={profileLink}> {userProfile.nip05} </a>
            {/if}
        </div>
    </div>
</div>
