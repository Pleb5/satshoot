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
        showNip05?: boolean;
        layout?: 'horizontal' | 'stacked';
        avatarSize?: 'tiny' | 'small' | 'medium' | 'large';
        compact?: boolean;
        nameScrollable?: boolean;
        nameClickable?: boolean;
    }

    let {
        pubkey = $bindable(),
        showLNAddress = false,
        showNip05 = true,
        layout = 'horizontal',
        avatarSize,
        compact = false,
        nameScrollable = false,
        nameClickable = true,
    }: Props = $props();

    let npub = $derived(nip19.npubEncode(pubkey));
    let profileLink = $derived('/' + npub);

    let userProfile = $state<NDKUserProfile | null>(null);

</script>

{#if layout === 'stacked'}
    <div class="w-full flex flex-col items-start gap-[6px] p-[5px]">
        {#if nameClickable}
            <a href={profileLink}>
                <Avatar {pubkey} bind:userProfile size={avatarSize ?? 'small'} />
            </a>
        {:else}
            <Avatar {pubkey} bind:userProfile size={avatarSize ?? 'small'} />
        {/if}
        <div class="w-full min-w-0 text-left">
            {#if nameClickable}
                <a href={profileLink} class="font-[600] break-words text-left leading-tight">
                    {userProfile?.name ??
                        userProfile?.displayName ??
                        shortenTextWithEllipsesInMiddle(npub, 15)}
                </a>
            {:else}
                <span class="font-[600] break-words text-left leading-tight">
                    {userProfile?.name ??
                        userProfile?.displayName ??
                        shortenTextWithEllipsesInMiddle(npub, 15)}
                </span>
            {/if}
            {#if showLNAddress}
                <div class="underline">LN Address:</div>
                <div class="text-yellow-500 break-words">{userProfile?.lud16 || ""}</div>
            {/if}
            {#if showNip05}
                <div class="grid grid-cols-1 {userProfile?.nip05 ? '' : 'hidden'}">
                    <div class="underline">NIP05:</div>
                    <a class="anchor break-words" href={profileLink}> {userProfile?.nip05 ?? ''} </a>
                </div>
            {/if}
        </div>
    </div>
{:else}
    <div
        class="w-full flex flex-row items-center {compact ? 'gap-[8px] p-0' : 'gap-[20px] p-[5px]'}"
    >
        <div class="flex flex-col shrink-0">
            {#if nameClickable}
                <a href={profileLink}>
                    <Avatar {pubkey} bind:userProfile size={avatarSize} />
                </a>
            {:else}
                <Avatar {pubkey} bind:userProfile size={avatarSize} />
            {/if}
        </div>
        <div class="flex flex-col min-w-0 {userProfile?.nip05 ? '' : 'justify-center'}">
            <div class="grid grid-cols-1 min-w-0">
                {#if nameClickable}
                    <a
                        href={profileLink}
                        class="font-[600] {nameScrollable
                            ? 'block max-w-full overflow-x-auto scrollbar-hide whitespace-nowrap'
                            : ''}"
                    >
                        {userProfile?.name ??
                            userProfile?.displayName ??
                            shortenTextWithEllipsesInMiddle(npub, 15)}
                    </a>
                {:else}
                    <span
                        class="font-[600] {nameScrollable
                            ? 'block max-w-full overflow-x-auto scrollbar-hide whitespace-nowrap'
                            : ''}"
                    >
                        {userProfile?.name ??
                            userProfile?.displayName ??
                            shortenTextWithEllipsesInMiddle(npub, 15)}
                    </span>
                {/if}
            </div>
            {#if showLNAddress}
                <div class="underline">LN Address:</div>
                <div class="text-yellow-500">{userProfile?.lud16 || ""}</div>
            {/if}
            {#if showNip05}
                <div class="grid grid-cols-1 {userProfile?.nip05 ? '' : 'hidden'}">
                    <div class="underline">NIP05:</div>
                    <a class="anchor" href={profileLink}> {userProfile?.nip05 ?? ''} </a>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }

    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
