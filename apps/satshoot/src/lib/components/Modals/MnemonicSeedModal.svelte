<script lang="ts">
    import { generateMnemonicSeed } from '$lib/wallet/nut-13';
    import SeedWords from '../Login/SeedWords.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        onCompletion: (mnemonicSeed: string[]) => void;
    }

    let { isOpen = $bindable(), onCompletion }: Props = $props();
    let seedWords = $state(Array(0));
    let confirmationWords = $state(Array(12).fill(""));
    let showSeedWords = $state(false);
    let step = $state(0);
    let seedSecuredConfirmation = $state(false);

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 ' +
        'dark:border-white-100 border-t-[0px] overflow-hidden rounded-[6px]';

    $effect(() => {
        if (!seedWords.length) {
            seedWords = generateMnemonicSeed().split(' ');
        }
    });

    function handleConfirm(confirmWords: string[]) {
        if (confirmWords.join(" ") !== seedWords.join(" ")) {
            alert("The seed words don't match!");
            return;
        }
        onCompletion(confirmWords);
    }
</script>

<ModalWrapper bind:isOpen title="Mnemonic Seed Words for Cashu Wallet">
    {#if step === 0}
        <section class="flex flex-col gap-4">
            <div>
                These seed words can be use to restore your wallet assuming mint support. Keep these
                words secret and secured, otherwise you may loose your funds.
            </div>
            <SeedWords bind:words={seedWords} inputsDisabled showCopyButton></SeedWords>
            <!--div class={inputWrapperClasses}>
                <Input
                    value={seedWords}
                    type={showSeedWords ? 'text' : 'password'}
                    readonly
                    grow
                    noBorder
                    notRounded
                />
                <Button
                    variant="outlined"
                    classes="border-l-[1px] border-l-black-100 rounded-[0px]"
                    onClick={() => (showSeedWords = !showSeedWords)}
                >
                    <i class={showSeedWords ? 'bx bxs-hide' : 'bx bxs-show'}></i>
                </Button>
            </div-->
            <div class="flex flex-row w-full gap-2">
                <Checkbox
                    id="confirm-checkbox"
                    label="I saved the seed words."
                    bind:checked={seedSecuredConfirmation}
                />
                <Button>Save to File</Button>
                <Button onClick={() => (step = 1)} disabled={!seedSecuredConfirmation}
                    >Continue</Button
                >
            </div>
        </section>
    {/if}
    {#if step === 1}
        <section class="flex flex-col gap-4">
            <span> Please reenter the seed words in the following fields for confirmation.</span>
            <SeedWords bind:words={confirmationWords}></SeedWords>
            <!--Input
                bind:value={confirmationWords}
                type={'text'}
                grow
                noBorder
                notRounded
                textarea={true}
            /-->
            <div class="flex">
                <div class="flex flex-row w-full gap-2">
                    <Button onClick={() => (step = 0)}>Back</Button>
                    <Button onClick={() => handleConfirm(confirmationWords)}>Confirm</Button>
                </div>
            </div>
        </section>
    {/if}
</ModalWrapper>
