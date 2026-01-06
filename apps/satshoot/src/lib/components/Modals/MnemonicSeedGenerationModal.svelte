<script lang="ts">
    import { generateMnemonicSeed, saveMnemonicToFile } from '$lib/wallet/nut-13';
    import SeedWords from '../Login/SeedWords.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
        onCompletion: (mnemonicSeed: string[]) => void;
    }

    let { isOpen = $bindable(), onCompletion }: Props = $props();
    let seedWords = $state(Array(0));
    let confirmationWords = $state(Array(12).fill(''));
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
        if (confirmWords.join(' ') !== seedWords.join(' ')) {
            toaster.error({
                title: "The seed words don't match!",
                duration: 10000, // 10 secs
            });
            return;
        }
        isOpen = false;
        toaster.info({
            title: 'Seed words confirmed!',
            duration: 10000, // 10 secs
        });
        onCompletion(confirmWords);
    }

    async function handleSaveToFile() {
        await saveMnemonicToFile(seedWords.join(" "));
    }
</script>

<ModalWrapper bind:isOpen title="Mnemonic Seed Words for Nostr Cashu Wallet">
    {#if step === 0}
        <section class="flex flex-col gap-4">
            <p>
                These seed words can be used to restore your wallet assuming mint support. Keep these
                words secret and secured, otherwise you may lose your funds.
            </p>
            <SeedWords bind:words={seedWords} inputsDisabled showCopyButton></SeedWords>
            <div class="flex flex-wrap w-full gap-2">
                <Checkbox
                    id="confirm-checkbox"
                    label="I saved the seed words."
                    bind:checked={seedSecuredConfirmation}
                />
                <Button onClick={handleSaveToFile}>
                    Save to File
                </Button>
                <Button onClick={() => (step = 1)} disabled={!seedSecuredConfirmation}
                    >Continue</Button
                >
            </div>
        </section>
    {/if}
    {#if step === 1}
        <section class="flex flex-col gap-4">
            <p>Please reenter the seed words in the following fields for confirmation.</p>
            <SeedWords bind:words={confirmationWords}></SeedWords>
            <div class="flex">
                <div class="flex flex-row w-full gap-2">
                    <Button onClick={() => (step = 0)}>Back</Button>
                    <Button onClick={() => handleConfirm(confirmationWords)}>Confirm</Button>
                </div>
            </div>
        </section>
    {/if}
</ModalWrapper>
