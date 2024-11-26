<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import {
        extractUnspentProofsForMint,
        getUniqueProofs,
        parseAndValidateBackup,
    } from '$lib/utils/cashu';
    import { NDKEvent } from '@nostr-dev-kit/ndk';
    import { NDKCashuToken, NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import { CashuMint, CashuWallet, type Proof } from '@cashu/cashu-ts';
    import { getFileExtension } from '$lib/utils/misc';
    import { decryptSecret } from '$lib/utils/crypto';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let cashuWallet: NDKCashuWallet;

    let recovering = false;
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
            recovering = true;

            // Read the file content
            let fileContent = await file.text();

            if (fileExtension === 'enc') {
                try {
                    fileContent = decryptSecret(fileContent, passphrase, $currentUser!.pubkey);
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
            const recoveringWallet = await NDKCashuWallet.from(walletNDKEvent);

            if (!recoveringWallet) {
                toastStore.trigger({
                    message: 'Failed to get Cashu Wallet from nostr event',
                    background: `bg-error-300-600-token`,
                });

                return;
            }

            // check if recovering wallet id matches the current wallet id
            if (recoveringWallet.tagId() !== cashuWallet.tagId()) {
                toastStore.trigger({
                    message: 'Recovering wallet id does not match already loaded wallet id!',
                    background: `bg-error-300-600-token`,
                });

                return;
            }

            // get ids of existing tokens in current wallet
            const existingTokenIds = cashuWallet.tokens.map((token) => token.id);

            // get existing proofs in current wallet
            const existingProofs = cashuWallet.tokens.map((t) => t.proofs).flat();

            // filter tokens from backup that don't exists in loaded wallet
            const missingTokens = backupJson.tokens.filter(
                (token) => !existingTokenIds.includes(token.id!)
            );

            if (missingTokens.length > 0) {
                // convert raw token events to NDKCashuTokens
                const ndkCashuTokens = missingTokens
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
                    // get all the proofs tied to tokens with a specific mint
                    const allProofs = ndkCashuTokens
                        .filter((t) => t.mint === mint)
                        .map((token) => token.proofs)
                        .flat();

                    const _wallet = new CashuWallet(new CashuMint(mint));
                    const spentProofs = await _wallet.checkProofsSpent(allProofs);

                    ndkCashuTokens
                        .filter((t) => t.mint === mint)
                        .map((token) => {
                            // for a token to be valid, it should not have any spent proof
                            // and no proof should be a duplicate of any existing proof in the wallet tokens

                            const proofsCountBeforeFilter = token.proofs.length;

                            // check if there's any proof that has been spent then this is not a valid token
                            const unspentProofs = getUniqueProofs(token.proofs, spentProofs);
                            if (proofsCountBeforeFilter !== unspentProofs.length) {
                                return;
                            }

                            // if there's any proof in existing proofs that matches any of the proof
                            // from this token, then its not a valid token
                            const uniqueProofs = getUniqueProofs(token.proofs, existingProofs);
                            if (proofsCountBeforeFilter !== uniqueProofs.length) {
                                return;
                            }

                            cashuWallet.addToken(token);
                        });
                });

                await Promise.all(tokenPromises);
            }

            toastStore.trigger({
                message: 'Wallet recovery successful!',
                background: `bg-success-300-600-token`,
            });
            modalStore.close();
        } catch (error) {
            console.error('Failed to recover wallet:', error);
            toastStore.trigger({
                message: 'Failed to recover wallet.',
                background: `bg-error-300-600-token`,
            });
        } finally {
            recovering = false;
        }
    }
</script>

{#if $modalStore[0]}
    <div class="card p-4 flex flex-col gap-y-4">
        <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Recover Ecash Wallet</h4>
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
            on:click={recover}
            class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
            disabled={recovering}
        >
            Recover
            {#if recovering}
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
