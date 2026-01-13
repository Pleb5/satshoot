<script lang="ts">
    import type { MintUrl } from '@nostr-dev-kit/ndk-wallet';
    import { CashuMint, type GetInfoResponse } from '@cashu/cashu-ts';
    import Avatar from '../Users/Avatar.svelte';
    import { onMount } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';

    type MintRecommendationUsage = import('@nostr-dev-kit/ndk-wallet').MintUsage & {
        endorsementsByPubkey: Map<string, { explicit: boolean; nutzap: boolean }>;
    };

    interface Props {
        mintUrl: MintUrl;
        mintUsage: MintRecommendationUsage;
        isSelected?: boolean;
        onSelectMint: (data: { mintUrl: MintUrl; isSelected: boolean }) => void;
    }

    let { mintUrl, mintUsage, isSelected = $bindable(false), onSelectMint }: Props = $props();

    let mintInfo: GetInfoResponse | null = $state(null);
    let gettingMintInfo = $state(true);
    let showEndorsements = $state(false);

    const endorsementEntries = $derived.by(() =>
        Array.from(mintUsage.endorsementsByPubkey.entries()).map(([pubkey, types]) => ({
            pubkey,
            ...types,
        }))
    );

    const endorsementCounts = $derived.by(() => {
        let explicitCount = 0;
        let nutzapCount = 0;

        mintUsage.endorsementsByPubkey.forEach((types) => {
            if (types.explicit) explicitCount += 1;
            if (types.nutzap) nutzapCount += 1;
        });

        return {
            explicitCount,
            nutzapCount,
            totalCount: mintUsage.pubkeys.size,
        };
    });

    const normalizeMintUrl = (url: string) => {
        const trimmed = url.trim();
        if (!trimmed) return null;
        const hasScheme = /^https?:\/\//i.test(trimmed);
        const candidate = hasScheme ? trimmed : `https://${trimmed}`;

        try {
            const parsed = new URL(candidate);
            if (!['http:', 'https:'].includes(parsed.protocol)) return null;
            return parsed.toString().replace(/\/$/, '');
        } catch {
            return null;
        }
    };

    // Fetch mint info on mount
    onMount(async () => {
        const normalizedUrl = normalizeMintUrl(mintUrl);

        if (!normalizedUrl) {
            gettingMintInfo = false;
            return;
        }

        try {
            const mint = new CashuMint(normalizedUrl);
            const info = await mint.getInfo();

            if (info.nuts[4]?.methods.some((method) => method.unit === 'sat')) {
                mintInfo = info;
            }
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

    function openEndorsements() {
        showEndorsements = true;
    }

    function handleEndorsementKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openEndorsements();
        }
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
    <div class="relative w-full">
        <Button
            classes={wrapperClasses}
            onClick={toggleSelection}
            variant={isSelected ? 'contained' : 'text'}
        >
            <span class="font-[500]">
                {mintInfo.name.length < 26 ? mintInfo.name : mintInfo.name.substring(0, 25) + '...'}
            </span>
            <span class="font-[300] text-[14px]">{mintInfo.description || ''}</span>
            {#if endorsementCounts.totalCount > 0}
                <div class="w-full flex flex-col gap-2 mt-[5px]">
                    <div
                        role="button"
                        tabindex="0"
                        class="flex items-center gap-2 text-left"
                        on:click|stopPropagation={openEndorsements}
                        on:keydown|stopPropagation={handleEndorsementKeydown}
                    >
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
                        <span class="text-[12px] font-[300]">
                            {endorsementCounts.totalCount > 4
                                ? `+${endorsementCounts.totalCount - 4} people from your WoT recommend this mint`
                                : 'People from your WoT recommend this mint'}
                        </span>
                    </div>
                    <div class="text-[12px] font-[300] text-black-300 dark:text-white-300">
                        Recommended by {endorsementCounts.explicitCount} • Trusted for zaps by
                        {endorsementCounts.nutzapCount}
                    </div>
                </div>
            {/if}
        </Button>

        <Popup
            bind:isOpen={showEndorsements}
            title="WoT endorsements"
            variant="popover"
            containerClasses="w-[90vw] max-w-[420px] left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0"
            cardClasses="shadow-deep"
        >
            <div class="flex flex-col gap-4 pt-[10px]">
                <p class="text-sm text-black-300 dark:text-white-300">
                    {endorsementCounts.totalCount} people from your Web of Trust endorse
                    {mintInfo?.name ?? mintUrl}.
                </p>
                <div class="flex flex-col gap-3 max-h-[50vh] overflow-auto scrollbar-hide">
                <div
                    class="grid grid-cols-[minmax(0,1fr)_70px_90px] gap-4 text-[10px] uppercase text-black-300 dark:text-white-300 sm:grid-cols-[minmax(0,1fr)_90px_120px]"
                >
                    <span>Person</span>
                    <span class="text-right">Recommended by</span>
                    <span class="text-right">Trusted for zaps by</span>
                </div>
                {#each endorsementEntries as endorser (endorser.pubkey)}
                    <div
                        class="grid grid-cols-[minmax(0,1fr)_70px_90px] items-center gap-4 border-b border-black-100 dark:border-white-100 py-1 sm:grid-cols-[minmax(0,1fr)_90px_120px]"
                    >
                        <div class="flex items-center min-w-0">
                            <UserProfile
                                pubkey={endorser.pubkey}
                                showNip05={false}
                                compact
                                avatarSize="small"
                                nameScrollable
                                nameClickable={false}
                            />
                        </div>
                        <div class="flex justify-end">
                            <input
                                type="checkbox"
                                class="accent-primary-500"
                                checked={endorser.explicit}
                                disabled
                            />
                        </div>
                        <div class="flex justify-end">
                            <input
                                type="checkbox"
                                class="accent-primary-500"
                                checked={endorser.nutzap}
                                disabled
                            />
                        </div>
                    </div>
                {/each}

                </div>
            </div>
        </Popup>
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
