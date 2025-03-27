<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { wallet } from '$lib/wallet/wallet';
    import {
        parseAndValidateBackup,
    } from '$lib/wallet/cashu';
    import { decryptSecret } from '$lib/utils/crypto';
    import { getFileExtension } from '$lib/utils/misc';
    import { CashuMint, CashuWallet } from '@cashu/cashu-ts';
    import { NDKEvent } from '@nostr-dev-kit/ndk';
    import { NDKCashuToken, NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let importing = false;
    let file: File | null = null;
    let passphrase = '';
    let showPassphraseInput = false;

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

    // Import function to read and parse the JSON file
    async function importWallet() {
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
            importing = true;

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

            // parse the content of selected json file
            // parseAndValidateBackup function will check if the file content matches the backup schema
            // if file content is not in correct shape it will return null
            const backupJson = parseAndValidateBackup(fileContent);

            if (!backupJson) {
                toastStore.trigger({
                    message: 'File content does not match the backup schema!',
                    background: `bg-error-300-600-token`,
                });

                return;
            }

            // check if wallet backup is related to current user
            if ($currentUser!.pubkey !== backupJson.wallet.pubkey) {
                toastStore.trigger({
                    message: 'Pubkey in wallet object does not match the pubkey of current user!',
                    background: `bg-error-300-600-token`,
                });

                return;
            }

            const walletNDKEvent = new NDKEvent($ndk, backupJson.wallet);
            const importingWallet = await NDKCashuWallet.from(walletNDKEvent);

            if (!importingWallet) {
                toastStore.trigger({
                    message: 'Failed to import Nostr Wallet!',
                    background: `bg-error-300-600-token`,
                });

                return;
            }

            wallet.set(importingWallet);

            // convert raw token events to NDKCashuTokens
            const ndkCashuTokens = backupJson.tokens
                .map((token) => {
                    const ndkCashuToken = new NDKCashuToken($ndk, token);
                    try {
                        const content = JSON.parse(ndkCashuToken.content);
                        ndkCashuToken.proofs = content.proofs;
                        if (!Array.isArray(ndkCashuToken.proofs)) return;
                    } catch (e) {
                        return;
                    }

                    return ndkCashuToken;
                })
                .filter((token) => token instanceof NDKCashuToken);

            // get all the unique mints from tokens
            const mints = new Set<string>();
            ndkCashuTokens.forEach((t) => {
                if (t.mint) mints.add(t.mint);
            });

            const mintsArray = Array.from(mints);
            const tokenPromises = mintsArray.map(async (mint) => {
                // get all tokens related to a specific mint
                const allTokens = ndkCashuTokens.filter((t) => t.mint === mint);

                // get all proofs from these tokens
                const allProofs = allTokens.map((t) => t.proofs).flat();

                // find all spent proofs
                const _wallet = new CashuWallet(new CashuMint(mint));
                const spentProofs = await _wallet.checkProofsSpent(allProofs);

                allTokens.forEach((token) => {
                    const unspentProofs = getUniqueProofs(token.proofs, spentProofs);

                    // we'll add token to Wallet only if it does not contain any spent proof
                    if (unspentProofs.length === token.proofs.length) {
                        importingWallet.addToken(token);
                    }
                });
            });

            await Promise.all(tokenPromises);

            toastStore.trigger({
                message: 'Wallet import successful!',
                background: `bg-success-300-600-token`,
            });
            modalStore.close();
        } catch (error) {
            console.error('Failed to import wallet:', error);
            toastStore.trigger({
                message: 'Failed to import wallet.',
                background: `bg-error-300-600-token`,
            });
        } finally {
            $wallet?.start()
            importing = false;
        }
    }
</script>

{#if $modalStore[0]}
    <div class="card p-4 flex flex-col gap-y-4">
        <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Import Ecash Wallet</h4>
        <input
            type="file"
            accept=".json,.enc"
            class="input text-center bg-transparent border-none rounded-md"
            aria-label="choose file"
            on:change={handleFileChange}
        />

        {#if showPassphraseInput}
            <input
                type="text"
                class="input rounded-md"
                aria-label="passphrase"
                placeholder="Enter passphrase for encryption (min. 14 chars)"
                bind:value={passphrase}
            />
        {/if}

        <button
            type="button"
            on:click={importWallet}
            class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
            disabled={importing}
        >
            Import
            {#if importing}
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
{/if}
