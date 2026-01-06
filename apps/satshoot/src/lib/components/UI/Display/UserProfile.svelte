<script lang="ts">
    import { shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import {
        type Hexpubkey,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import Avatar from '$lib/components/Users/Avatar.svelte';

    interface Props {
        pubkey: Hexpubkey;
        showLNAddress?: boolean;
    }

    let { pubkey = $bindable(), showLNAddress = false }: Props = $props();

    let npub = $derived(nip19.npubEncode(pubkey));
    let profileLink = $derived('/' + npub);

    let userProfile = $state<NDKUserProfile | null>(null);

</script>

<div class="w-full flex flex-row gap-[20px] p-[5px]">
    <div class="flex flex-col">
        <a href={profileLink}>
            <Avatar {pubkey} bind:userProfile />
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
        {#if showLNAddress}
            <div class="underline">LN Address:</div>
            <div class="text-yellow-500">{userProfile?.lud16 || ""}</div>
        {/if}
        <div class="grid grid-cols-1 {userProfile?.nip05 ? '' : 'hidden'}">
            <div class="underline">NIP05:</div>
            <a class="anchor" href={profileLink}> {userProfile?.nip05 ?? ''} </a>
        </div>
    </div>
</div>
