<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import {
        NDKCashuWallet,
        type MintUrl,
        type NDKCashuMintRecommendation,
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

    let { isOpen = $bindable(), cashuWallet, callback }: Props = $props();

    let recommendations = $state<NDKCashuMintRecommendation>();
    let selectedMints = $state<MintUrl[]>([]);

    $effect(() => {
        if (cashuWallet) {
            selectedMints = [...cashuWallet.mints];
        }
    });

    $effect(() => {
        getCashuMintRecommendations($ndk, $wot)
            .then((res) => {
                recommendations = res;
            })
            .catch((err) => {
                console.error(`An error occurred in getting cashu mint recommendations`, err);
                toaster.error({
                    title: 'An error occurred in getting cashu mint recommendations',
                });
                isOpen = false;
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
        {#if recommendations}
            <div class="w-full max-h-[50vh] flex flex-col gap-[10px] overflow-auto">
                <div class="w-full flex flex-col gap-[10px]">
                    {#each Object.entries(recommendations) as [mintUrl, mintUsage] (mintUrl)}
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

            <div
                class="w-full flex items-center justify-center gap-[10px] pt-[10px] mt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
            >
                <Button variant="outlined" onClick={() => (isOpen = false)} grow>Cancel</Button>
                <Button onClick={handleSelect} grow>Save</Button>
            </div>
        {:else}
            <div class="flex w-full justify-center justify-self-center">
                <div class="p-4 space-y-4 w-full">
                    {#each { length: 4 } as _}
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
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</ModalWrapper>
