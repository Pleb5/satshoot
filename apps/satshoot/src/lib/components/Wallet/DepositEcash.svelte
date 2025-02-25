<script lang="ts">
    import { NDKCashuToken, type NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import { cashuTokensBackup } from '$lib/stores/wallet';

    const toastStore = getToastStore();

    export let cashuWallet: NDKCashuWallet;

    let depositing = false;
    let amount = 0;
    let unit = 'sat';
    let selectedMint = '';

    $: {
        amount ??= 0;
    }

    $: if (cashuWallet.mints.length > 0 && !selectedMint) {
        selectedMint = cashuWallet.mints[0];
    }

    async function deposit() {
        depositing = true;
        const ndkCashuDeposit = cashuWallet.deposit(amount, selectedMint, unit);

        ndkCashuDeposit.on('success', async (token) => {
            // Token received has encrypted content
            // but we want to store it in local storage as un-encrypted.
            // Therefore, we'll have to make it un-encrypted

            const newToken = await NDKCashuToken.from(token);

            if (newToken) {
                console.log('ndkCashuDeposit successful', newToken.rawEvent());

                cashuTokensBackup.update((map) => {
                    // add newToken to backup
                    map.set(newToken.id, newToken.rawEvent());

                    return map;
                });
            }

            closeModal();
            toastStore.trigger({
                message: `Successfully deposited ${amount} ${unit}!`,
                timeout: 5000,
                autohide: true,
                background: `bg-success-300-600-token`,
            });
            depositing = false;
            amount = 0;
        });
        ndkCashuDeposit.on('error', (error) => {
            console.log('ndkCashuDeposit failed', error);
            depositing = false;
            closeModal();
            toastStore.trigger({
                message: `Failed to deposit!`,
                autohide: false,
                background: `bg-error-300-600-token`,
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
            class="input bg-transparent border-[0] border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        >
            <option value="" disabled>Select a mint</option>
            {#each cashuWallet.mints as mint (mint)}
                <option value={mint}>{mint}</option>
            {/each}
        </select>
    </div>
    <Button
        variant="text"
        classes="bg-black-100 text-black-50 dark:text-white-300 border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        on:click={deposit}
        disabled={depositing || !amount || !selectedMint}
    >
        Deposit
        {#if depositing}
            <ProgressRadial
                value={undefined}
                stroke={60}
                meter="stroke-error-500"
                track="stroke-error-500/30"
                strokeLinecap="round"
                width="w-8"
            />
        {/if}
    </Button>
</div>
