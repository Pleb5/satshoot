<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import {
        getCashuMintRecommendations,
        NDKCashuWallet,
        type MintUrl,
        type NDKCashuMintRecommendation,
    } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import { onMount } from 'svelte';
    import CashuMintListItem from '$lib/components/Mints/Item.svelte';

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

    onMount(() => {
        getCashuMintRecommendations($ndk)
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
    });
</script>

{#if $modalStore[0]}
    <div class="card p-4 flex flex-col gap-y-4 min-w-[90vw] sm:min-w-[60vw] md:min-w-[30vw]">
        <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Choose Mint</h4>
        <div class="h-[50vh] w-full flex flex-col overflow-y-auto">
            <div class="divide-y flex flex-col">
                {#if recommendations}
                    {#each Object.entries(recommendations) as [mintUrl, mintUsage] (mintUrl)}
                        <CashuMintListItem
                            {mintUrl}
                            {mintUsage}
                            isSelected={selectedMints.includes(mintUrl)}
                            on:selectMint={(e) =>
                                toggleMintSelection(e.detail.mintUrl, e.detail.isSelected)}
                        />
                    {/each}
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
        </div>
        <div class="flex justify-between">
            <button
                type="button"
                class="btn btn-sm sm:btn-md bg-error-300-600-token"
                on:click={() => modalStore.close()}
            >
                Cancel
            </button>
            <button
                type="button"
                on:click={handleSelect}
                class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
            >
                Apply
            </button>
        </div>
    </div>
{/if}
