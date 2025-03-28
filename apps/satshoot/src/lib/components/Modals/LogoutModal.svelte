<script lang="ts">
    import { wallet } from '$lib/stores/wallet';
    import { backupWallet } from '$lib/utils/cashu';
    import { logout } from '$lib/utils/helpers';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Popup from '../UI/Popup.svelte';
    import { loginMethod } from '$lib/stores/user';
    import { LoginMethod } from '$lib/stores/ndk';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let backupBeforeLogout = true;
    let showBackupCheckbox = false;
    let encryptWalletBackup = false;
    let passphrase = '';
    let errorMessage = '';
    let showPassphrase = false;

    // Reactive declarations to handle validation
    $: passphraseValid = passphrase.length > 13;

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

        logout();
    }

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 dark:border-white-100 border-t-[0px] overflow-hidden rounded-[6px]';
</script>

{#if $modalStore[0]}
    <Popup title="Confirm Logout">
        <div class="w-full flex flex-col">
            <!-- popups Logout start -->
            <div class="w-full py-[10px] px-[5px]">
                <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px]">
                    <p class="w-full">Do really you wish to log out?</p>
                    {#if $loginMethod === LoginMethod.Local}
                        <div
                            class="w-full py-[5px] px-[10px] rounded-[6px] bg-orange-500 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                        >
                            <p class="font-[600] text-[16px] text-white">
                                Local Keypair will be deleted, make sure you have a backup!
                            </p>
                        </div>
                    {/if}
                    {#if showBackupCheckbox}
                        <Checkbox
                            id="backup-wallet"
                            label="Backup Cashu wallet before logging out"
                            bind:checked={backupBeforeLogout}
                        />

                        {#if backupBeforeLogout}
                            <Checkbox
                                id="encrypt-wallet-backup"
                                label="Encrypt backup with passphrase"
                                bind:checked={encryptWalletBackup}
                            />

                            {#if encryptWalletBackup}
                                <div class={inputWrapperClasses}>
                                    <Input
                                        bind:value={passphrase}
                                        type={showPassphrase ? 'text' : 'password'}
                                        placeholder="Enter passphrase for encryption (min. 14 chars)"
                                        classes={!passphraseValid ? 'input-error' : ''}
                                        grow
                                        noBorder
                                        notRounded
                                    />
                                    <Button
                                        variant="outlined"
                                        classes="border-l-[1px] border-l-black-100 rounded-[0px]"
                                        on:click={() => (showPassphrase = !showPassphrase)}
                                    >
                                        <i class={showPassphrase ? 'bx bxs-hide' : 'bx bxs-show'} />
                                    </Button>
                                </div>
                            {/if}
                        {/if}
                    {/if}

                    <Button fullWidth on:click={confirmLogout}>Confirm Logout</Button>
                </div>
            </div>
            <!-- popups Logout end -->
        </div>
    </Popup>
{/if}
