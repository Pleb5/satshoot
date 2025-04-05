<script lang="ts">
    import currentUser from '$lib/stores/user';
    import {
        getModalStore,
        getToastStore,
        ProgressRadial 
    } from '@skeletonlabs/skeleton';
    import { getFileExtension } from '$lib/utils/misc';
    import { decryptSecret } from '$lib/utils/crypto';
    import Popup from '../UI/Popup.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { ndkNutzapMonitor, wallet } from '$lib/wallet/wallet';
    import { parseAndValidateBackup, recoverWallet } from '$lib/wallet/cashu';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let recovering = $state(false);
    let file = $state<File | null>(null);
    let passphrase = $state('');
    let showPassphraseInput = $state(false);
    let showPassphrase = $state(false);

    // Handle file selection
    function handleFileChange(event: Event) {
        showPassphraseInput = false;
        const target = event.target as HTMLInputElement;
        file = target.files ? target.files[0] : null;

        if (file) {
            const fileExtension = getFileExtension(file.name);
            if (fileExtension === 'enc') showPassphraseInput = true;
        }
    }

    // Recover function to read and parse the JSON file
    async function recover() {
        if (!file) {
            toastStore.trigger({
                message: 'Please select a JSON file.',
                background: `bg-error-300-600-token`,
            });
            return;
        }

        const fileExtension = getFileExtension(file.name);

        if (!fileExtension) {
            toastStore.trigger({
                message: `Failed to recover wallet. Couldn't identify file type.`,
                background: `bg-error-300-600-token`,
            });

            return;
        }

        if (fileExtension !== 'json' && fileExtension !== 'enc') {
            toastStore.trigger({
                message: `Failed to recover wallet. Invalid file type. Only .json or .enc is accepted.`,
                background: `bg-error-300-600-token`,
            });

            return;
        }

        try {
            if (!$wallet) {
                toastStore.trigger({
                    message: 'Nostr wallet NOT found! Can only recover into an existing wallet',
                    background: `bg-error-300-600-token`,
                });

                return;
            } 

            recovering = true;

            // Read the file content
            let fileContent = await file.text();

            if (fileExtension === 'enc') {
                try {
                    fileContent = decryptSecret(
                        fileContent,
                        passphrase,
                        $currentUser!.pubkey
                    );
                } catch (error) {
                    toastStore.trigger({
                        message: 'Failed to decrypt backup file',
                        background: `bg-error-300-600-token`,
                    });
                    return;
                }
            }

            const walletStorage = parseAndValidateBackup(fileContent);

            if (!walletStorage) throw new Error(
                'Wallet backup does not match the backup schema!'
            );

            await recoverWallet(walletStorage, $wallet, ndkNutzapMonitor!);

            toastStore.trigger({
                message: 'Wallet Loaded Successfully!',
                background: `bg-success-300-600-token`,
            });
            modalStore.close();
        } catch (error) {
            console.error('Failed to recover wallet:', error);
            toastStore.trigger({
                message: `Failed to recover wallet:\n${error}`,
                background: `bg-error-300-600-token`,
            });
        } finally {
            recovering = false;
        }
    }

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 ' +
        'dark:border-white-100 border-t-[0px] overflow-hidden rounded-[6px]';
</script>

{#if $modalStore[0]}
    <Popup title="Recover Ecash Wallet">
        <div class="flex flex-col gap-[10px] mt-4">
            <input
                type="file"
                accept=".json,.enc"
                class="input text-center bg-transparent rounded-md"
                aria-label="choose file"
                onchange={handleFileChange}
            />

            {#if showPassphraseInput}
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

            <Button on:click={recover} disabled={recovering}>
                Recover
                {#if recovering}
                    <span>
                        <ProgressRadial
                            value={undefined}
                            stroke={60}
                            meter="stroke-white-500"
                            track="stroke-white-500/30"
                            strokeLinecap="round"
                            width="w-8"
                        />
                    </span>
                {/if}
            </Button>
        </div>
    </Popup>
{/if}
