<script lang="ts">
    import type { MintUrl, MintUsage } from '@nostr-dev-kit/ndk-wallet';
    import { CashuMint, type GetInfoResponse } from '@cashu/cashu-ts';
    import Avatar from '../Users/Avatar.svelte';
    import { onMount } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';

    interface Props {
        mintUrl: MintUrl;
        mintUsage: MintUsage;
        isSelected?: boolean;
        onSelectMint: (data: { mintUrl: MintUrl; isSelected: boolean }) => void;
    }

    let { mintUrl, mintUsage, isSelected = $bindable(false), onSelectMint }: Props = $props();

    let mintInfo: GetInfoResponse | null = $state(null);
    let gettingMintInfo = $state(true);

    // Fetch mint info on mount
    onMount(async () => {
        try {
            const mint = new CashuMint(mintUrl);
            const info = await mint.getInfo();

            if (info.nuts[4]?.methods.some((method) => method.unit === 'sat')) {
                mintInfo = info;
            }
        } catch (err) {
            console.error('Error fetching mint info:', mintUrl, err);
        } finally {
            gettingMintInfo = false;
        }
    });

    function toggleSelection() {
        isSelected = !isSelected;
        onSelectMint({
            mintUrl,
            isSelected,
        });
    }

    let selectedClass = $derived(
        isSelected
            ? 'bg-blue-500 hover:bg-blue-500 text-white'
            : 'bg-black-100 hover:bg-black-100 dark:bg-white-100 dark:hover:bg-white-100'
    );

    let wrapperClasses = $derived(
        selectedClass +
            ' w-full flex flex-col items-start gap-[3px] ' +
            'px-[10px] py-[10px] text-left relative outline-[0px]'
    );

    const avatarWrapperClasses =
        'transition-all ease-in-out duration-[0.3s] min-w-[30px] min-h-[30px] w-[30px] h-[30px] ' +
        'rounded-full border-[2px] border-white shadow-deep flex flex-col justify-center items-center ' +
        'relative overflow-hidden bg-white-200 backdrop-blur-[10px] text-[12px] leading-none hover:border-[2px]';
</script>

<!-- Loading State -->
{#if gettingMintInfo}
    <div class="p-4 space-y-4 w-full">
        <div class="placeholder animate-pulse"></div>
        <div class="grid grid-cols-3 gap-8">
            <div class="placeholder animate-pulse"></div>
            <div class="placeholder animate-pulse"></div>
            <div class="placeholder animate-pulse"></div>
        </div>
        <div class="grid grid-cols-4 gap-4">
            <div class="placeholder animate-pulse"></div>
            <div class="placeholder animate-pulse"></div>
            <div class="placeholder animate-pulse"></div>
            <div class="placeholder animate-pulse"></div>
        </div>
    </div>
{:else if mintInfo}
    <Button
        classes={wrapperClasses}
        onClick={toggleSelection}
        variant={isSelected ? 'contained' : 'text'}
    >
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
    </Button>
{/if}
