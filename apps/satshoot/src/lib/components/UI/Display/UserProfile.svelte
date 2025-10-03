<script lang="ts">
    import ndk from '$lib/stores/session';
    import { getRoboHashPicture, shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import {
        NDKEvent,
        NDKKind,
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
        profileFromEvent,
        type Hexpubkey,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import ProfileImage from './ProfileImage.svelte';

    interface Props {
        pubkey: Hexpubkey;
    }

    let { pubkey = $bindable() }: Props = $props();

    let npub = $derived(nip19.npubEncode(pubkey));
    let profileLink = $derived('/' + npub);

    let userProfile = $state<NDKUserProfile | null>(null);
    let avatarImage = $derived(
        userProfile?.picture ?? userProfile?.image ?? getRoboHashPicture(pubkey)
    );

    $effect(() => {
        if (pubkey) fetchUserProfile();
    });

    const fetchUserProfile = async () => {
        const metadataFilter = {
            kinds: [NDKKind.Metadata],
            authors: [pubkey],
        };

        const metadataRelays = [...$ndk.pool!.connectedRelays()];

        const profileEvent: NDKEvent | null = await $ndk.fetchEvent(
            metadataFilter,
            { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST },
            new NDKRelaySet(new Set(metadataRelays), $ndk)
        );

        if (!profileEvent) return;

        userProfile = profileFromEvent(profileEvent);
    };
</script>

<div class="w-full flex flex-row gap-[20px] p-[5px]">
    <div class="flex flex-col">
        <a href={profileLink}>
            <ProfileImage src={avatarImage} />
        </a>
    </div>
    <div class="flex flex-col {userProfile?.nip05 ? '' : 'justify-center'}">
        <div class="grid grid-cols-1">
            <a href={profileLink} class="font-[600]">
                {userProfile?.name ??
                    userProfile?.displayName ??
                    shortenTextWithEllipsesInMiddle(npub, 15)}
            </a>
        </div>
        <div class="grid grid-cols-1 {userProfile?.nip05 ? '' : 'hidden'}">
            <a href={profileLink}> {userProfile?.nip05 ?? ''} </a>
        </div>
    </div>
</div>
