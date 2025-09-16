<script lang="ts">
    import SeedWords from '../Login/SeedWords.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { validateMnemonicSeed } from '$lib/wallet/nut-13';

    interface Props {
        isOpen: boolean;
        onConfirm: (mnemonicSeed: string[]) => void;
        onSkip: () => void;
    }

    let { isOpen = $bindable(), onConfirm: onConfirm, onSkip: onSkip }: Props = $props();
    let seedWords = $state(Array(12).fill(''));

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 ' +
        'dark:border-white-100 border-t-[0px] overflow-hidden rounded-[6px]';

    $effect(() => {});

    function handleConfirm(confirmWords: string[]) {
        if (!validateMnemonicSeed(confirmWords.join(' '))) {
            toaster.error({
                title: 'The seed words are invalid, please check them!',
                duration: 10000, // 10 secs
            });
            return;
        }
        isOpen = false;
        toaster.info({
            title: 'Seed words validated!',
            duration: 10000, // 10 secs
        });
        onConfirm(confirmWords);
    }

    function handleSkip() {
        isOpen = false;
        onSkip();
    }
</script>

<ModalWrapper bind:isOpen title="Input Mnemonic Seed Words for your Cashu Wallet">
    <section class="flex flex-col gap-4">
        <span>
            If you already have a Cashu wallet with mnemonic seed words, please reenter them in the
            following fields. This is important to ensure the funds you'll receive are backed up by
            the same seed and the whole wallet can be recovered.
        </span>
        <span>Otherwise just skip this step.</span>
        <SeedWords bind:words={seedWords}></SeedWords>
        <div class="flex">
            <div class="flex flex-row w-full gap-2">
                <Button onClick={handleSkip}>Skip</Button>
                <Button onClick={() => handleConfirm(seedWords)}>Confirm</Button>
            </div>
        </div>
    </section>
</ModalWrapper>
