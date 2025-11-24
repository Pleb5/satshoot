<script lang="ts">
    import SeedWords from '../Login/SeedWords.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { validateMnemonicSeed } from '$lib/wallet/nut-13';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Card from '../UI/Card.svelte';
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

    let { isOpen = $bindable(), recoverFromSeed, mints = $bindable(), isDeterministic }: Props = $props();
    let seedWords = $state(Array(12).fill(''));
    let wordsTypedIn = $derived(seedWords.filter(w => w.length > 0).length == 12);
    let mintSelection = $state(Array<MintEntry>());
    let mintSelected = $derived(mintSelection.filter(e => e.selected).length > 0);
    let useThisWalletsSeed = $state(false);
    let step = $state(0);
    let recovering = $state(false);

    $effect(() => {
        if (mints && mints.length !== mintSelection.length) {
            mintSelection = mints.map(mint => { 
                return { mintUrl: mint, selected: false } });
        }
    });

    async function handleConfirm(confirmWords: string[], mintSelection: MintEntry[]) {
        if (!mintSelection.filter(me => me.selected).length) return;

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
        mintSelection.forEach(me => me.selected = false);
        step = 0;
        isOpen = false;
        recovering = false;
    }

</script>

<ModalWrapper bind:isOpen title="Recover Cashu Wallet from Seed">
    <section class="flex flex-col gap-4">
        {#if step == 0}
            <span>
                If you want to recover funds from an external wallet, enter its mnemonic seed words bellow. Note that  
                after recovery, the funds remain backed up through the entered seed words and not the ones of this wallet.
            </span>
            {#if isDeterministic}
                <span>
                    Otherwise select "from this wallet's seed", if you miss funds here.
                </span>
                <div class="text-[14px]">
                    <Checkbox
                        id="from-this-seed"
                        label="from this wallet's seed"
                        bind:checked={useThisWalletsSeed}
                    />    
                </div>
            {/if}
            {#if !useThisWalletsSeed}
                <SeedWords bind:words={seedWords}></SeedWords>
            {/if}
            <div class="flex">
                <div class="flex flex-row w-full gap-2">
                    <Button disabled={!useThisWalletsSeed && !wordsTypedIn} onClick={() => step++}>Next</Button>
                </div>
            </div>
        {/if}

        {#if step > 0}
            <span>
                Select the mints to recover from.
            </span>

            <div class="w-full flex flex-col gap-[10px]">
                <Card>
                    <div class="w-full flex flex-col text-[14px] gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100">
                        {#each mintSelection as selection, index }
                            <Checkbox id={index.toString()} label={selection.mintUrl} bind:checked={selection.selected} />
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
