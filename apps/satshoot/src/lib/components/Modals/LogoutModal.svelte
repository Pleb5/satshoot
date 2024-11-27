<script lang="ts">
    import { wallet } from '$lib/stores/wallet';
    import { backupWallet } from '$lib/utils/cashu';
    import { logout } from '$lib/utils/helpers';
    import { getModalStore, getDrawerStore, getToastStore } from '@skeletonlabs/skeleton';

    const drawerStore = getDrawerStore();
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let backupBeforeLogout = true;
    let showBackupCheckbox = false;
    let encryptWalletBackup = false;
    let passphrase = '';
    let errorMessage = '';

    $: if ($wallet) {
        showBackupCheckbox = true;
    }

    async function confirmLogout() {
        errorMessage = '';
        try {
            if (backupBeforeLogout && $wallet) {
                if (encryptWalletBackup && passphrase.length < 14) {
                    errorMessage = 'passphrase should have at least 14 chars';
                    return;
                }
                await backupWallet($wallet, encryptWalletBackup, passphrase);
            }
        } catch (error) {
            console.error('An error occurred in backup process', error);
            toastStore.trigger({
                message: `Failed to backup! An error occurred in backup process.`,
                background: `bg-error-300-600-token`,
            });

            return;
        }

        modalStore.close();
        drawerStore.close();

        logout();
    }
</script>

{#if $modalStore[0]}
    <div
        class="modal block overflow-y-auto bg-surface-100-800-token w-modal h-auto p-4 space-y-4 rounded-container-token shadow-xl"
    >
        <header class="modal-header text-2xl font-bold">Confirm log out</header>

        <article class="modal-body max-h-[200px] overflow-hidden">
            <p>Do really you wish to log out?</p>
            <strong class="text-error-400-500-token">
                If you are logged in with a Local Keypair, it will be deleted from local storage!
            </strong>
            {#if showBackupCheckbox}
                <div class="flex items-center space-x-2 mt-4">
                    <input
                        type="checkbox"
                        id="additionalAction"
                        bind:checked={backupBeforeLogout}
                    />
                    <label for="additionalAction"> Backup Cashu wallet before logging out </label>
                </div>
            {/if}

            {#if backupBeforeLogout}
                <div class="flex items-center space-x-2 mt-4">
                    <input
                        type="checkbox"
                        id="encryptWalletBackup"
                        bind:checked={encryptWalletBackup}
                    />
                    <label for="encryptWalletBackup"> Encrypt backup with passphrase </label>
                </div>
            {/if}

            {#if encryptWalletBackup}
                <input
                    type="text"
                    class="input rounded-md mt-4"
                    aria-label="passphrase"
                    placeholder="Enter passphrase for encryption (min. 14 chars)"
                    bind:value={passphrase}
                />
            {/if}
        </article>

        <footer class="modal-footer flex justify-end space-x-2">
            <button
                type="button"
                class="btn variant-ghost-surface"
                on:click={() => modalStore.close()}>Cancel</button
            >
            <button type="button" class="btn variant-filled" on:click={confirmLogout}
                >Confirm</button
            >
        </footer>
        {#if passphrase}
            <div class="text-error-500 text-center">{errorMessage}</div>
        {/if}
    </div>
{/if}
