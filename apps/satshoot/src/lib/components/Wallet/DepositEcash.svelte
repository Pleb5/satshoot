<script lang="ts">
    import { type NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const toastStore = getToastStore();

    interface Props {
        cashuWallet: NDKCashuWallet;
    }

    let { cashuWallet }: Props = $props();

    let depositing = $state(false);
    let amount = $state(0);
    let selectedMint = $state('');

    $effect(() => {
        amount ??= 0;
    });

    // Initialize selected mint
    $effect(() => {
        if (cashuWallet.mints.length > 0 && !selectedMint) {
            selectedMint = cashuWallet.mints[0];
        }
    });

    async function deposit() {
        depositing = true;
        const ndkCashuDeposit = cashuWallet.deposit(amount, selectedMint);

        // The deposit process updates wallet state that is captured in
        // 'balance_updated' event, on which a backup is triggered (see walletInit)
        ndkCashuDeposit.on('success', () => {
            closeModal();
            toastStore.trigger({
                message: `Successfully deposited ${amount} sats!`,
                timeout: 5000,
                autohide: true,
                background: `bg-success-300-600`,
            });
            depositing = false;
            amount = 0;
        });

        ndkCashuDeposit.on('error', (error) => {
            console.log('ndkCashuDeposit failed', error);
            depositing = false;
            closeModal();
            toastStore.trigger({
                message: `Failed to deposit: \n${error}`,
                autohide: false,
                background: `bg-error-300-600`,
            });
        });

        const pr = await ndkCashuDeposit.start();

        const { init, launchPaymentModal, closeModal } = await import('@getalby/bitcoin-connect');
        init({ appName: 'SatShoot' });

        launchPaymentModal({
            invoice: pr,
        });
    }
</script>

<div
    class="w-full flex flex-col rounded-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200"
>
    <div class="w-full flex flex-col">
        <Input
            type="number"
            placeholder="000,000 sats"
            min="1"
            step="1"
            bind:value={amount}
            fullWidth
            notRounded
            noBorder
            classes="bg-transparent"
        />

        <select
            bind:value={selectedMint}
            class="input bg-transparent border-0 border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        >
            <option value="" disabled>Select a mint</option>
            {#each cashuWallet.mints as mint (mint)}
                <option value={mint}>{mint}</option>
            {/each}
        </select>
    </div>
    <Button
        variant="text"
        classes="bg-black-100 text-black-50 dark:text-white border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        on:click={deposit}
        disabled={depositing || !amount || !selectedMint}
    >
        Deposit
        {#if depositing}
            <ProgressRing color="error" />
        {/if}
    </Button>
</div>
