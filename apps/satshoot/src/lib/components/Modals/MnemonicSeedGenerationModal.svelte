    }
</script>
    import SeedWords from '../Login/SeedWords.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

        }
        isOpen = false;
        toaster.info({
            title: 'Seed words confirmed!',
            duration: 10000, // 10 secs
        });
        onCompletion(confirmWords);
    }
</script>
<ModalWrapper bind:isOpen title="Mnemonic Seed Words for Cashu Wallet">
    {#if step === 0}
        <section class="flex flex-col gap-4">
            <p>
                These seed words can be use to restore your wallet assuming mint support. Keep these
                words secret and secured, otherwise you may loose your funds.
            </p>
            <SeedWords bind:words={seedWords} inputsDisabled showCopyButton></SeedWords>
            <div class="flex flex-row w-full gap-2">
                <Checkbox
                    id="confirm-checkbox"
    {/if}
    {#if step === 1}
        <section class="flex flex-col gap-4">
            <p>Please reenter the seed words in the following fields for confirmation.</p>
            <SeedWords bind:words={confirmationWords}></SeedWords>
            <div class="flex">
                <div class="flex flex-row w-full gap-2">
                    <Button onClick={() => (step = 0)}>Back</Button>