<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import {
        getCashuMintRecommendations,
        type MintUrl,
        type NDKCashuMintRecommendation,
    } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import { onMount } from 'svelte';
    import CashuMintListItem from '$lib/components/Mints/Item.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let recommendations: NDKCashuMintRecommendation;

    let selectedMints: MintUrl[] = [];

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
    <div class="card p-4 flex flex-col gap-y-4">
        <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Choose Mint</h4>
        <div class="h-[50vh] w-full flex flex-col overflow-y-auto overflow-x-clip border">
            <div class="h-max w-full divide-y flex flex-col items-stretch justify-stretch">
                {#if recommendations}
                    {#each Object.entries(recommendations) as [mintUrl, mintUsage] (mintUrl)}
                        <CashuMintListItem
                            {mintUrl}
                            {mintUsage}
                            on:selectMint={(e) =>
                                toggleMintSelection(e.detail.mintUrl, e.detail.isSelected)}
                        />
                    {/each}
                {/if}
            </div>
        </div>
        <div class="flex justify-center gap-2">
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
                Select
            </button>
        </div>
    </div>
{/if}
