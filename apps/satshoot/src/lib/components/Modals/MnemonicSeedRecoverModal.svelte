<script lang="ts">
    import SeedWords from '../Login/SeedWords.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { validateMnemonicSeed } from '$lib/wallet/nut-13';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Card from '../UI/Card.svelte';
    import { onMount } from 'svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    interface Props {
        isOpen: boolean;
        recoverFromSeed: (mnemonicSeed: string[], mint: string) => Promise<{ errors: any[], amount: number }>;
        mints?: string[];
        isDeterministic?: boolean;
    }

    type MintEntry = {
        mintUrl: string,
        selected: boolean
    };

    let { isOpen = $bindable(), recoverFromSeed, mints, isDeterministic }: Props = $props();
    let seedWords = $state(Array(12).fill(''));
    let validWords = $derived(seedWords.filter(w => w.length > 0).length == 12);
    let mintSelection = $state(Array<MintEntry>());
    let mintSelected = $derived(mintSelection.filter(e => e.selected).length > 0);
    let useThisWalletsSeed = $state(false);
    let step = $state(0);
    let recovering = $state(false);

    onMount(() => {
        if (mints) {
            mintSelection = mints.map(mint => { 
                return { mintUrl: mint, selected: false } });
        }
    });

    $effect(() => {});

    async function handleConfirm(confirmWords: string[], mintSelection: MintEntry[]) {
        if (!mintSelection.length) return;

        if (!useThisWalletsSeed && !validateMnemonicSeed(confirmWords.join(' '))) {
            toaster.error({
                title: 'The seed words are invalid, please check them!',
                duration: 10000, // 10 secs
            });
            return;
        }
        recovering = true;
        const selectedMints = mintSelection.filter(entry => entry.selected).map(entry => entry.mintUrl);
        for (const mint of selectedMints) {
            try {
                const { errors, amount } = await recoverFromSeed(confirmWords, mint);
                if (!errors.length) {
                    toaster.success({
                        title: `${amount} sats recovered from mint: ${mint}`,
                        duration: 10000, // 5 secs
                    });
                } else {
                    toaster.error({
                        title: `Errors occurred recovering from mint: ${mint}, ${amount} sats recovered`,
                        duration: 10000,
                    });
                }
            } catch(e) {
                toaster.error({
                    title: `Error recovering from mint: ${mint}`,
                    duration: 10000,
                });
            }
        }
        isOpen = false;
        recovering = false;
    }

</script>

<ModalWrapper bind:isOpen title="Recover Cashu Wallet from Seed">
    <section class="flex flex-col gap-4">
        {#if step == 0}
            <span>
                If you want to recover funds from an external wallet, enter its mnemonic seed words bellow. Note that  
                after recovery, the funds remain backed up through the entered seed words.
            </span>
            {#if isDeterministic}
                <span>
                    Otherwise please select "from this wallet's seed", if you miss funds partially or completely.
                </span>
                <Checkbox
                    id="from-this-seed"
                    label="from this wallet's seed"
                    bind:checked={useThisWalletsSeed}
                />    
            {/if}
            {#if !useThisWalletsSeed}
                <SeedWords bind:words={seedWords}></SeedWords>
            {/if}
            <div class="flex">
                <div class="flex flex-row w-full gap-2">
                    <Button disabled={!useThisWalletsSeed && !validWords} onClick={() => step++}>Next</Button>
                </div>
            </div>
        {/if}

        {#if step > 0}
            <span>
                Select the mints to recover from or add new ones.
            </span>

            <div class="w-full flex flex-col gap-[10px]">
                <Card>
                    <div class="flex justify-center">
                        <Button onClick={() => {}}>
                            Add Mint
                        </Button>
                    </div>
                    <div class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100">
                        {#each mints as mint, index }
                            <Checkbox id={index.toString()} label={mint} bind:checked={mintSelection[index].selected} />
                        {/each}
                    </div>
                </Card>
            </div>

            <div class="flex flex-row w-full gap-2">
                <div class="flex">
                    <div class="flex flex-row w-full gap-2">
                        <Button disabled={recovering} onClick={() => step--}>Back</Button>
                    </div>
                </div>
                <div class="flex">
                    <div class="flex flex-row w-full gap-2">
                        <Button disabled={!mintSelected || recovering} onClick={() => handleConfirm(seedWords, mintSelection)}>
                            {#if recovering}
                                <ProgressRing color="white" />
                            {:else}
                                Confirm
                            {/if}
                            
                        </Button>
                    </div>
                </div>
            </div>
        {/if}
    </section>
</ModalWrapper>
