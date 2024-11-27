<script lang="ts">
    import { backupWallet } from '$lib/utils/cashu';
    import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let cashuWallet: NDKCashuWallet;

    let processing = false;
    let passphrase = '';
    let encrypted = false;
    let errorMessage = '';

    async function handleWalletBackup() {
        try {
            errorMessage = '';
            if (encrypted && passphrase.length < 14) {
                errorMessage = 'passphrase should have at least 14 chars';
                return;
            }

            await backupWallet(cashuWallet, encrypted, passphrase);
            modalStore.close();
        } catch (error) {
            console.error('An error occurred in backup process', error);
            toastStore.trigger({
                message: `Failed to backup! An error occurred in backup process.`,
                background: `bg-error-300-600-token`,
            });
        }
    }
</script>

{#if $modalStore[0]}
    <div class="card p-4 flex flex-col gap-y-4">
        <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Backup Ecash Wallet</h4>

        <div class="flex items-center space-x-2">
            <input type="checkbox" id="additionalAction" bind:checked={encrypted} />
            <label for="additionalAction"> Encrypt backup with passphrase </label>
        </div>

        {#if encrypted}
            <input
                type="text"
                class="input rounded-md p-2 w-full"
                aria-label="passphrase"
                placeholder="Enter passphrase for encryption (min. 14 chars)"
                bind:value={passphrase}
            />
        {/if}

        <button
            type="button"
            on:click={handleWalletBackup}
            class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
            disabled={processing}
        >
            Backup
            {#if processing}
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

        <div class="text-error-500 text-center">{errorMessage}</div>
    </div>
{/if}
