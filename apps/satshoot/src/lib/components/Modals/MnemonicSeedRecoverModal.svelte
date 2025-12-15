<script lang="ts">
    import SeedWords from '../Login/SeedWords.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { validateMnemonicSeed } from '$lib/wallet/nut-13';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Card from '../UI/Card.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import { wallet } from '$lib/wallet/wallet';
    import Input from '../UI/Inputs/input.svelte';

    interface Props {
        isOpen: boolean;
        recoverFromSeed: (mnemonicSeed: string[], mint: string) => Promise<{ errors: any[], amount: number }>;
        updateMints: (mints: string[]) => Promise<void>;
        mints?: string[];
        isDeterministic?: boolean;
    }

    type MintEntry = {
        mintUrl: string,
        selected: boolean
    };

    let { isOpen = $bindable(), recoverFromSeed, updateMints, mints = $bindable(), isDeterministic }: Props = $props();
    let seedWords = $state(Array(12).fill(''));
    let wordsTypedIn = $derived(seedWords.filter(w => w.length > 0).length == 12);
    let mintSelection = $state(Array<MintEntry>());
    let mintSelected = $derived(mintSelection.filter(e => e.selected).length > 0);
    let mintToAdd = $state("");
    let localMints = $state(Array<string>());
    let useThisWalletsSeed = $state(false);
    let step = $state(0);
    let recovering = $state(false);

    $effect(() => {
        if (mints && !localMints.length) {
            localMints = mints;
        }
        if (localMints.length !== mintSelection.length) {
            mintSelection = localMints.map(mint => { 
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
        const newMints = selectedMints.filter(m => !$wallet!.mints.includes(m));
        if (newMints.length) {
            $wallet!.mints.push(...newMints);
            await updateMints($wallet!.mints);
        }
        for (const mint of selectedMints) {
            try {
                const { errors, amount } = await recoverFromSeed(useThisWalletsSeed ? [] : confirmWords, mint);
                if (!errors.length) {
                    toaster.success({
                        title: `${amount} sats recovered from mint: ${mint}`,
                        duration: 10000, // 10 secs
                    });
                    if (!useThisWalletsSeed && amount) {// send funds to the same wallet to secure them with the seed.
                        try {
                            await $wallet?.transferAllFundsTo($wallet, { skipConsolidation: true, transferMints: mint}); 
                        } catch(e) {
                            toaster.warning({
                                title: `The recovered funds aren't backed up by this wallet's seed. To solve this issue, migrate to new wallet.`,
                                duration: 30000
                            });
                        }
                    }
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
        mints = localMints;
        mintSelection.forEach(me => me.selected = false);
        step = 0;
        isOpen = false;
        recovering = false;
    }

    function isValidMintURL(url: string) {
        try {
            const u = new URL(url);
            if (u.protocol !== "https:" && u.protocol !== "http:") {
                return false;
            }
        } catch {
            return false;
        }

        return true;
    }

    function handleAddMint() {
        localMints.push(mintToAdd);
        mintSelection.push({ mintUrl: mintToAdd, selected: true});
        mintToAdd = "";
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

            <div class="flex">
                <div class="flex flex-row w-full gap-2">
                    <Input bind:value={mintToAdd} placeholder={"https://"} fullWidth={true}/>
                    <Button disabled={!isValidMintURL(mintToAdd)} onClick={handleAddMint}>Add Mint</Button>
                </div>
            </div>

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
