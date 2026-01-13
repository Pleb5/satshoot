<script lang="ts">
    import ndk from '$lib/stores/session';
    import {
        NDKCashuWallet,
        type MintUrl,
    } from '@nostr-dev-kit/ndk-wallet';

    import CashuMintListItem from '$lib/components/Mints/Item.svelte';
    import { wot } from '$lib/stores/wot';
    import { getCashuMintRecommendations } from '$lib/wallet/cashu';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
        cashuWallet: NDKCashuWallet;
        callback: (selectedMints: string[]) => void;
    }

    type MintRecommendationUsage = import('@nostr-dev-kit/ndk-wallet').MintUsage & {
        endorsementsByPubkey: Map<string, { explicit: boolean; nutzap: boolean }>;
    };

    let { isOpen = $bindable(), cashuWallet, callback }: Props = $props();

    let recommendations = $state<Record<MintUrl, MintRecommendationUsage> | null>(null);
    let recommendationsLoading = $state(false);
    let recommendationsError = $state<string | null>(null);
    let selectedMints = $state<MintUrl[]>([]);
    let wasOpen = $state(false);

    let recommendationEntries = $derived.by(
        () =>
            (recommendations ? Object.entries(recommendations) : []) as Array<
                [MintUrl, MintRecommendationUsage]
            >
    );

    $effect(() => {
        if (cashuWallet) {
            selectedMints = [...cashuWallet.mints];
        }
    });

    $effect(() => {
        if (!isOpen) {
            wasOpen = false;
            return;
        }

        if (wasOpen) return;

        wasOpen = true;
        recommendations = null;
        recommendationsError = null;
        recommendationsLoading = true;

        const wotSnapshot = new Set($wot);
        getCashuMintRecommendations($ndk, wotSnapshot)
            .then((res) => {
                recommendations = res as Record<MintUrl, MintRecommendationUsage>;
            })
            .catch((err) => {
                console.error(`An error occurred in getting cashu mint recommendations`, err);
                recommendationsError =
                    'Unable to load mint recommendations from your Web of Trust. Please try again.';
                toaster.error({
                    title: 'An error occurred in getting cashu mint recommendations',
                    duration: 60000, // 1 min
                });
            })
            .finally(() => {
                recommendationsLoading = false;
            });
    });

    function toggleMintSelection(mintUrl: MintUrl, isSelected: boolean) {
        if (isSelected) {
            selectedMints = [...selectedMints, mintUrl];
        } else {
            selectedMints = selectedMints.filter((url) => url !== mintUrl);
        }
    }

    function handleSelect() {
        callback(selectedMints);
        isOpen = false;
    }
</script>

<ModalWrapper bind:isOpen title="Choose Mint">
    <div class="w-full pt-[10px] px-[5px]">
        {#if recommendationsLoading}
            <div class="flex flex-col items-center gap-2 py-8 text-center">
                <i class="bx bx-loader-circle bx-spin text-2xl text-primary-500"></i>
                <p class="text-sm text-black-300 dark:text-white-300">
                    Fetching mint recommendations from your Web of Trust.
                </p>
                <p class="text-xs text-black-300 dark:text-white-300">
                    Using connected relays and cached data. This usually takes a few seconds.
                </p>
            </div>
        {:else if recommendationsError}
            <div class="flex flex-col items-center gap-2 py-8 text-center">
                <i class="bx bx-error-circle text-2xl text-error-500"></i>
                <p class="text-sm text-black-300 dark:text-white-300">{recommendationsError}</p>
                <Button variant="outlined" onClick={() => (isOpen = false)}>Close</Button>
            </div>
        {:else if recommendations}
            {#if recommendationEntries.length === 0}
                <div class="flex flex-col items-center gap-2 py-8 text-center">
                    <i class="bx bx-info-circle text-2xl text-black-300 dark:text-white-300"></i>
                    <p class="text-sm text-black-300 dark:text-white-300">
                        No mint recommendations from your Web of Trust yet.
                    </p>
                </div>
            {:else}
                <div class="w-full max-h-[50vh] flex flex-col gap-[10px] overflow-auto">
                    <div class="w-full flex flex-col gap-[10px]">
                        {#each recommendationEntries as [mintUrl, mintUsage] (mintUrl)}
                            <CashuMintListItem
                                {mintUrl}
                                {mintUsage}
                                isSelected={selectedMints.includes(mintUrl)}
                                onSelectMint={(data) =>
                                    toggleMintSelection(data.mintUrl, data.isSelected)}
                            />
                        {/each}
                    </div>
                </div>
            {/if}

            <div
                class="w-full flex items-center justify-center gap-[10px] pt-[10px] mt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
            >
                <Button variant="outlined" onClick={() => (isOpen = false)} grow>Cancel</Button>
                <Button onClick={handleSelect} grow>Save</Button>
            </div>
        {:else}
            <div class="flex flex-col items-center gap-2 py-8 text-center">
                <i class="bx bx-loader-circle bx-spin text-2xl text-primary-500"></i>
                <p class="text-sm text-black-300 dark:text-white-300">Preparing recommendations…</p>
            </div>
        {/if}
    </div>
</ModalWrapper>
