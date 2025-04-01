<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import {
        NDKCashuWallet,
        type MintUrl,
        type NDKCashuMintRecommendation,
    } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import CashuMintListItem from '$lib/components/Mints/Item.svelte';
    import { wot } from '$lib/stores/wot';
    import { getCashuMintRecommendations } from '$lib/wallet/cashu';
    import Popup from '../UI/Popup.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let cashuWallet: NDKCashuWallet;

    let recommendations: NDKCashuMintRecommendation;
    let selectedMints: MintUrl[] = [];

    $: if (cashuWallet) {
        selectedMints = [...cashuWallet.mints];
    }

    function toggleMintSelection(mintUrl: MintUrl, isSelected: boolean) {
        if (isSelected) {
            selectedMints = [...selectedMints, mintUrl];
        } else {
            selectedMints = selectedMints.filter((url) => url !== mintUrl);
        }
    }

    function handleSelect() {
        if ($modalStore[0].response) {
            $modalStore[0].response(selectedMints);
            modalStore.close();
        }
    }

    $: {
        getCashuMintRecommendations($ndk, $wot)
            .then((res) => {
                recommendations = res;
            })
            .catch((err) => {
                console.error(`An error occurred in getting cashu mint recommendations`, err);
                toastStore.trigger({
                    message: 'An error occurred in getting cashu mint recommendations',
                    autohide: false,
                    background: `bg-error-300-600-token`,
                });
                modalStore.close();
            });
    }
</script>

{#if $modalStore[0]}
    <Popup title="Choose Mint">
        <div class="w-full pt-[10px] px-[5px]">
            {#if recommendations}
                <div class="w-full max-h-[50vh] flex flex-col gap-[10px] overflow-auto">
                    <div class="w-full flex flex-col gap-[10px]">
                        {#each Object.entries(recommendations) as [mintUrl, mintUsage] (mintUrl)}
                            <CashuMintListItem
                                {mintUrl}
                                {mintUsage}
                                isSelected={selectedMints.includes(mintUrl)}
                                on:selectMint={(e) =>
                                    toggleMintSelection(e.detail.mintUrl, e.detail.isSelected)}
                            />
                        {/each}
                    </div>
                </div>

                <div
                    class="w-full flex items-center justify-center gap-[10px] pt-[10px] mt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                >
                    <Button variant="outlined" on:click={() => modalStore.close()} grow
                        >Cancel</Button
                    >
                    <Button on:click={handleSelect} grow>Save</Button>
                </div>
            {:else}
                <div class="flex w-full justify-center justify-self-center">
                    <div class="p-4 space-y-4 w-full">
                        {#each { length: 4 } as _}
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
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </Popup>
{/if}
