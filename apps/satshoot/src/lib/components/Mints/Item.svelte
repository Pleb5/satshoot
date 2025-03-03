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

    $: wrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-col rounded-[6px] gap-[3px] px-[10px] py-[10px] relative ' +
        `${isSelected ? 'bg-blue-500 text-white' : 'bg-black-100 dark:bg-white-100'} hover:bg-black-200`;

    const avatarWrapperClasses =
        'transition-all ease-in-out duration-[0.3s] min-w-[30px] min-h-[30px] w-[30px] h-[30px] ' +
        'rounded-full border-[2px] border-white shadow-deep flex flex-col justify-center items-center ' +
        'relative overflow-hidden bg-white-200 backdrop-blur-[10px] text-[12px] leading-[1] hover:border-[2px]';
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
        class={wrapperClasses}
        role="button"
        on:click={toggleSelection}
        on:keydown={handleKeydown}
        tabindex="0"
    >
        <input
            type="checkbox"
            name="mintsWalletCheckbox"
            checked={isSelected}
            class="w-full absolute top-[0] bottom-[0] right-[0] left-[0] opacity-[0] cursor-pointer peer"
        />

        <span class="font-[500]">
            {mintInfo.name.length < 26 ? mintInfo.name : mintInfo.name.substring(0, 25) + '...'}
        </span>
        <span class="font-[300] text-[14px]">{mintInfo.description || ''}</span>
        <div class="w-full flex flex-row gap-[10px] mt-[5px] items-center">
            <div class="flex flex-row flex-wrap">
                {#if mintUsage.pubkeys.size > 0}
                    <div class="flex flex-row items-center gap-2">
                        <div class="flex flex-row -space-x-2">
                            {#each Array.from(mintUsage.pubkeys).slice(0, 4) as pubkey}
                                <div
                                    class="transition-all ease-in-out duration-[0.3s] flex flex-col justify-center items-center ml-0"
                                >
                                    <div class={avatarWrapperClasses}>
                                        <Avatar {pubkey} size="tiny" />
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            {#if mintUsage?.pubkeys.size > 4}
                <p class="font-[300] text-[14px]">
                    +{mintUsage.pubkeys.size - 4} recommendations
                </p>
            {/if}
        </div>
    </div>
{/if}
