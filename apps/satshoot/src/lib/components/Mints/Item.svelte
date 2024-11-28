<script lang="ts">
    import type { MintUrl, MintUsage } from '@nostr-dev-kit/ndk-wallet';
    import { CashuMint, type GetInfoResponse } from '@cashu/cashu-ts';
    import Avatar from '../Users/Avatar.svelte';
    import { createEventDispatcher } from 'svelte';

    const dispatcher = createEventDispatcher();

    export let mintUrl: MintUrl;
    export let mintUsage: MintUsage;
    export let isSelected = false;

    let mintInfo: GetInfoResponse | null = null;
    let gettingMintInfo = true;

    $: {
        const mint = new CashuMint(mintUrl);
        mint.getInfo()
            .then((info) => {
                if (info.nuts[4].methods.some((method) => method.unit === 'sat')) {
                    mintInfo = info;
                }
            })
            .catch((err) => {
                console.error('An error occurred in getting mint info', mintUrl, err);
            })
            .finally(() => {
                gettingMintInfo = false;
            });
    }

    function toggleSelection() {
        isSelected = !isSelected;
        dispatcher('selectMint', {
            mintUrl,
            isSelected,
        });
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            toggleSelection();
            event.preventDefault(); // Prevents the default scrolling behavior when pressing the space bar
        }
    }
</script>

{#if gettingMintInfo}
    <div class="p-4 space-y-4 w-full">
        <div class="placeholder animate-pulse" />
        <div class="grid grid-cols-3 gap-8">
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
        </div>
        <div class="grid grid-cols-4 gap-4">
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
        </div>
    </div>
{:else if mintInfo}
    <div
        class="flex justify-between p-2 pr-4 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
        role="button"
        on:click={toggleSelection}
        on:keydown={handleKeydown}
        tabindex="0"
    >
        <div class="flex flex-col gap-2 w-full">
            <div class="flex justify-between">
                <h3 class="text-foreground font-bold">
                    <span>
                        {mintInfo.name.length < 26
                            ? mintInfo.name
                            : mintInfo.name.substring(0, 25) + '...'}
                    </span>
                </h3>
                <input type="checkbox" class="checkbox" bind:checked={isSelected} />
            </div>
            <div class="text-muted-foreground">
                {mintInfo.description || ''}
            </div>

            {#if mintUsage.pubkeys.size > 0}
                <div class="flex flex-row items-center gap-2">
                    <div class="flex flex-row -space-x-2">
                        {#each Array.from(mintUsage.pubkeys).slice(0, 4) as pubkey}
                            <Avatar {pubkey} size="tiny" />
                        {/each}
                    </div>
                    <div class="flex justify-between items-center gap-x-1">
                        {#if mintUsage.pubkeys.size > 4}
                            <span
                                class="bg-secondary text-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs"
                            >
                                +{mintUsage.pubkeys.size - 4}
                            </span>
                        {/if}
                        <span class="text-muted-foreground text-xs"> recommendations </span>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}
