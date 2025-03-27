<script lang="ts">
    import { backupWallet } from '$lib/utils/cashu';
    import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import Popup from '../UI/Popup.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    interface Props {
        cashuWallet: NDKCashuWallet;
    }

    let { cashuWallet }: Props = $props();

    let processing = false;
    let passphrase = $state('');
    let encrypted = $state(false);
    let showPassphrase = $state(false);
    let errorMessage = $state('');

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

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 dark:border-white-100 border-t-[0px] overflow-hidden rounded-[6px]';
</script>

{#if $modalStore[0]}
    <Popup title="Backup Ecash Wallet">
        <div class="flex flex-col gap-[10px] mt-4">
            <Checkbox
                id="additionalAction"
                label="Encrypt backup with passphrase"
                bind:checked={encrypted}
            />

            {#if encrypted}
                <div class={inputWrapperClasses}>
                    <Input
                        bind:value={passphrase}
                        type={showPassphrase ? 'text' : 'password'}
                        placeholder="Enter passphrase for encryption (min. 14 chars)"
                        grow
                        noBorder
                        notRounded
                    />
                    <Button
                        variant="outlined"
                        classes="border-l-[1px] border-l-black-100 rounded-[0px]"
                        on:click={() => (showPassphrase = !showPassphrase)}
                    >
                        <i class={showPassphrase ? 'bx bxs-hide' : 'bx bxs-show'}></i>
                    </Button>
                </div>
            {/if}

            <Button on:click={handleWalletBackup} disabled={processing}>
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
            </Button>

            <div class="text-error-500 text-center">{errorMessage}</div>
        </div>
    </Popup>
{/if}
