<script lang="ts">
    import currentUser from '$lib/stores/user';

    import { getFileExtension } from '$lib/utils/misc';
    import { decryptSecret } from '$lib/utils/crypto';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { ndkNutzapMonitor, wallet } from '$lib/wallet/wallet';
    import { parseAndValidateBackup, recoverWallet } from '$lib/wallet/cashu';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

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
            toaster.error({
                title: 'Please select a JSON file.',
            });
            return;
        }

        const fileExtension = getFileExtension(file.name);

        if (!fileExtension) {
            toaster.error({
                title: `Failed to recover wallet. Couldn't identify file type.`,
            });

            return;
        }

        if (fileExtension !== 'json' && fileExtension !== 'enc') {
            toaster.error({
                title: `Failed to recover wallet. Invalid file type. Only .json or .enc is accepted.`,
            });

            return;
        }

        try {
            if (!$wallet) {
                toaster.error({
                    title: 'Nostr wallet NOT found! Can only recover into an existing wallet',
                });

                return;
            }

            recovering = true;

            // Read the file content
            let fileContent = await file.text();

            if (fileExtension === 'enc') {
                try {
                    fileContent = decryptSecret(fileContent, passphrase, $currentUser!.pubkey);
                } catch (error) {
                    toaster.error({
                        title: 'Failed to decrypt backup file',
                    });
                    return;
                }
            }

            const walletStorage = parseAndValidateBackup(fileContent);

            if (!walletStorage) throw new Error('Wallet backup does not match the backup schema!');

            await recoverWallet(walletStorage, $wallet, ndkNutzapMonitor!);

            toaster.success({
                title: 'Wallet Loaded Successfully!',
            });
            isOpen = false;
        } catch (error) {
            console.error('Failed to recover wallet:', error);
            toaster.error({
                title: `Failed to recover wallet:\n${error}`,
            });
        } finally {
            recovering = false;
        }
    }

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 ' +
        'dark:border-white-100 border-t-[0px] overflow-hidden rounded-[6px]';
</script>

<ModalWrapper bind:isOpen title="Recover Ecash Wallet">
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
                    onClick={() => (showPassphrase = !showPassphrase)}
                >
                    <i class={showPassphrase ? 'bx bxs-hide' : 'bx bxs-show'}></i>
                </Button>
            </div>
        {/if}

        <Button onClick={recover} disabled={recovering}>
            Recover
            {#if recovering}
                <span>
                    <ProgressRing color="white" />
                </span>
            {/if}
        </Button>
    </div>
</ModalWrapper>
