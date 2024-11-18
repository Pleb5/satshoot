<script lang="ts">
    import { cashuTokensBackup } from '$lib/stores/wallet';
    import { NDKCashuToken, type NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();
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
            modalStore.close();
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

{#if $modalStore[0]}
    <div class="card p-4 flex flex-col gap-y-4">
        <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Choose Amount</h4>
        <div class="flex flex-col items-center">
            <input
                type="number"
                min="0"
                bind:value={amount}
                class="input text-center bg-transparent text-5xl border-none rounded-md"
                aria-label="deposit amount"
            />

            <div class="text-3xl text-muted-foreground font-light">
                {unit}
            </div>
        </div>
        <select bind:value={selectedMint} class="input mt-4 p-2 bg-transparent border rounded-md">
            <option value="" disabled>Select a mint</option>
            {#each cashuWallet.mints as mint (mint)}
                <option value={mint}>{mint}</option>
            {/each}
        </select>
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
                on:click={deposit}
                class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                disabled={depositing || !amount || !selectedMint}
            >
                Deposit
                {#if depositing}
                    <span>
                        <ProgressRadial
                            value={undefined}
                            stroke={60}
                            meter="stroke-error-500"
                            track="stroke-error-500/30"
                            strokeLinecap="round"
                            width="w-8"
                        />
                    </span>
                {/if}
            </button>
        </div>
    </div>
{/if}
