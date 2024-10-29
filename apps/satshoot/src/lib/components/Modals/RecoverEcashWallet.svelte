<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { extractUnspentProofsForMint, parseAndValidateBackup } from '$lib/utils/cashu';
    import { NDKEvent } from '@nostr-dev-kit/ndk';
    import { NDKCashuToken, NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let cashuWallet: NDKCashuWallet;

    let recovering = false;
    let file: File | null = null;

    // Handle file selection
    function handleFileChange(event: Event) {
        const target = event.target as HTMLInputElement;
        file = target.files ? target.files[0] : null;
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

        try {
            recovering = true;

            // Read the file content
            const fileContent = await file.text();

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

            // filter tokens from backup that don't exists in loaded wallet
            const missingTokens = backupJson.tokens.filter(
                (token) => !existingTokenIds.includes(token.id!)
            );

            if (missingTokens.length > 0) {
                // convert raw token events to NDKCashuTokens
                // this also decrypts the private tags in token events
                const promises = missingTokens.map((token) => {
                    const ndkEvent = new NDKEvent($ndk, token);
                    return NDKCashuToken.from(ndkEvent);
                });

                const ndkCashuTokens = await Promise.all(promises)
                    .then((tokens) => {
                        return tokens.filter((token) => token instanceof NDKCashuToken);
                    })
                    .catch(() => {
                        toastStore.trigger({
                            message:
                                'Error occurred in converting raw token events to NDKCashuToken',
                            background: `bg-error-300-600-token`,
                        });
                        return null;
                    });

                if (!ndkCashuTokens) return;

                // get all the unique mints from tokens
                const mints = new Set<string>();
                ndkCashuTokens.forEach((t) => {
                    if (t.mint) mints.add(t.mint);
                });

                const mintsArray = Array.from(mints);
                const tokenPromises = mintsArray.map(async (mint) => {
                    // get all the unspent proofs for a mint
                    const unspentProofs = await extractUnspentProofsForMint(
                        mint,
                        ndkCashuTokens.filter((t) => t.mint === mint)
                    );

                    const existingProofSet = new Set<string>();

                    cashuWallet.tokens
                        .filter((t) => t.mint === mint)
                        .forEach((token) => {
                            token.proofs.forEach((p) => existingProofSet.add(p.id));
                        });

                    // find all the unspent proofs that are not in current wallet
                    const proofsToSave = unspentProofs.filter((p) => !existingProofSet.has(p.id));

                    console.log('proofsToSave :>> ', proofsToSave);

                    if (proofsToSave.length > 0) return cashuWallet.saveProofs(proofsToSave, mint);
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
            accept=".json"
            class="input text-center bg-transparent border-none rounded-md"
            aria-label="choose file"
            on:change={handleFileChange}
        />

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
