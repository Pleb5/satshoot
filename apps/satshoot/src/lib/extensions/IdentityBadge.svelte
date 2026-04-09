<script lang="ts">
    import type { NDKUserProfile } from '@nostr-dev-kit/ndk';

    import Avatar from '$lib/components/Users/Avatar.svelte';
    import { shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';

    interface Props {
        pubkey?: string | null;
        emptyText: string;
        helperText?: string;
        sizeClasses?: string;
    }

    let { pubkey = null, emptyText, helperText = '', sizeClasses = 'w-11 h-11' }: Props = $props();

    let userProfile = $state<NDKUserProfile | null>(null);

    const displayName = $derived.by(() => {
        if (!pubkey) return '';
        return userProfile?.name || userProfile?.displayName || shortenTextWithEllipsesInMiddle(pubkey, 16);
    });

    const displayPubkey = $derived.by(() => {
        if (!pubkey) return '';
        return shortenTextWithEllipsesInMiddle(pubkey, 18);
    });
</script>

{#if pubkey}
    <div class="flex min-w-0 max-w-full items-center gap-[10px]">
        <Avatar
            {pubkey}
            bind:userProfile
            showWoT={false}
            {sizeClasses}
            classes="border-transparent hover:border-transparent!"
        />
        <div class="min-w-0 max-w-full flex flex-col gap-[2px]">
            <p class="truncate text-[14px] font-[700] text-black-500 dark:text-white">{displayName}</p>
            <p class="break-all text-[12px] text-black-300 dark:text-white-300">{displayPubkey}</p>
        </div>
    </div>
{:else}
    <div class="flex flex-col gap-[4px]">
        <p class="text-[13px] font-[600] text-black-500 dark:text-white">{emptyText}</p>
        {#if helperText}
            <p class="text-[12px] text-black-300 dark:text-white-300">{helperText}</p>
        {/if}
    </div>
{/if}
