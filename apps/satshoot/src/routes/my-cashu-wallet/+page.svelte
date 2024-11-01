<script lang="ts">
    import ndk, { blastrUrl, DEFAULTRELAYURLS } from '$lib/stores/ndk';
    import {
        cashuPaymentInfoMap,
        cashuTokensBackup,
        unsavedProofsBackup,
        wallet,
    } from '$lib/stores/wallet';
    import { NDKCashuToken, NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import {
        getModalStore,
        getToastStore,
        popup,
        type ModalComponent,
        type ModalSettings,
        type ToastSettings,
        type PopupSettings,
    } from '@skeletonlabs/skeleton';
    import EditProfileModal from '../../lib/components/Modals/EditProfileModal.svelte';
    import TrashIcon from '$lib/components/Icons/TrashIcon.svelte';
    import DepositEcashModal from '$lib/components/Modals/DepositEcashModal.svelte';
    import ExploreMintsModal from '$lib/components/Modals/ExploreMintsModal.svelte';
    import { NDKCashuMintList, NDKPrivateKeySigner, NDKRelaySet } from '@nostr-dev-kit/ndk';
    import WithdrawEcashModal from '$lib/components/Modals/WithdrawEcashModal.svelte';
    import currentUser from '$lib/stores/user';
    import Warning from '$lib/components/Warning.svelte';
    import { displayEcashWarning } from '$lib/stores/gui';
    import { arraysAreEqual, getCashuPaymentInfo } from '$lib/utils/helpers';
    import RecoverEcashWallet from '$lib/components/Modals/RecoverEcashWallet.svelte';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    let cashuWallet: NDKCashuWallet | null = null;

    $: if ($wallet) {
        cashuWallet = $wallet;
    }

    let walletBalance = 0;
    let walletUnit = 'sats';

    $: if (cashuWallet) {
        cashuWallet.balance().then((res) => {
            if (res) {
                walletBalance = res[0].amount;
                walletUnit = res[0].unit;
            }
        });

        console.log('cashuWallet.tokens :>> ', cashuWallet.tokens);

        cashuWallet.on('balance_updated', (balance) => {
            cashuWallet!.balance().then((res) => {
                if (res) {
                    walletBalance = res[0].amount;
                    walletUnit = res[0].unit;
                }
            });
        });
    }

    async function setupWallet() {
        const newWallet = new NDKCashuWallet($ndk);
        const mintPromise = new Promise<string[] | undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: ExploreMintsModal,
                props: { cashuWallet: newWallet },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (mints?: string[]) => {
                    resolve(mints);
                },
            };
            modalStore.trigger(modal);
        }).then((mints) => {
            if (!mints || !mints.length) return;

            newWallet.mints = mints;
        });

        await mintPromise;

        if (!newWallet.mints.length) {
            const t: ToastSettings = {
                message: `No mint is selected. Choose at-least 1 mint`,
            };
            toastStore.trigger(t);

            return;
        }

        const signer = NDKPrivateKeySigner.generate();

        newWallet.privkey = signer.privateKey;
        newWallet.relays = DEFAULTRELAYURLS;
        newWallet.name = 'My Cashu Wallet';

        let walletPublished = false;

        await newWallet
            .publish()
            .then(() => {
                const t: ToastSettings = {
                    message: `Cashu Wallet created!`,
                };
                toastStore.trigger(t);
                walletPublished = true;
            })
            .catch((err) => {
                console.error(err);
                const t: ToastSettings = {
                    message: `Failed to create Cashu Wallet: ${err}`,
                };
                toastStore.trigger(t);
            });

        if (walletPublished) {
            wallet.set(newWallet);
            const cashuMintList = new NDKCashuMintList($ndk);

            const user = await signer.user();
            cashuMintList.p2pk = user.pubkey;
            cashuMintList.relays = DEFAULTRELAYURLS;
            cashuMintList.mints = newWallet.mints;

            publishCashuMintList(cashuMintList);
        }
    }

    async function updateWallet() {
        try {
            await cashuWallet!.publish();

            wallet.set(cashuWallet);

            toastStore.trigger({
                message: `Walled updated!`,
            });

            // after wallet has been updated we should update cashu payment info
            const ndkCashuMintList = await getCashuPaymentInfo($currentUser!.pubkey, true);

            // only update cashu payment info if relays or mints are mismatching
            if (
                ndkCashuMintList instanceof NDKCashuMintList &&
                (!arraysAreEqual(cashuWallet!.mints, ndkCashuMintList.mints) ||
                    !arraysAreEqual(cashuWallet!.relays, ndkCashuMintList.relays))
            ) {
                // NOTE: This logic may not work in case of multiple wallet, will be refactored later
                ndkCashuMintList.mints = cashuWallet!.mints;
                ndkCashuMintList.relays = cashuWallet!.relays;

                publishCashuMintList(ndkCashuMintList);
            }
        } catch (e) {
            console.trace(e);
            toastStore.trigger({
                message: `Wallet update failed! Reason: ${e}`,
            });
        }
    }

    async function publishCashuMintList(cashuMintList: NDKCashuMintList) {
        const relayUrls = new Set<string>();

        relayUrls.add(blastrUrl);

        $ndk.pool.urls().forEach((relayUrl) => {
            relayUrls.add(relayUrl);
        });

        cashuMintList.relays.forEach((relayUrl) => {
            relayUrls.add(relayUrl);
        });

        cashuMintList
            .publishReplaceable(NDKRelaySet.fromRelayUrls(Array.from(relayUrls), $ndk))
            .then(() => {
                const t: ToastSettings = {
                    message: `Cashu Payment Info updated!`,
                };
                toastStore.trigger(t);

                // Set user's payment info on successful wallet and info publish
                $cashuPaymentInfoMap.set($currentUser!.pubkey, cashuMintList);
            })
            .catch((err) => {
                console.error(err);
                const t: ToastSettings = {
                    message: `Failed to update Cashu Payment Info : ${err}`,
                };
                toastStore.trigger(t);
            });
    }

    function editName() {
        // If user confirms modal do the editing
        new Promise<string | undefined>((resolve) => {
            const data = cashuWallet!.name ?? '';
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: { dataToEdit: data, fieldName: 'Name' },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (editedData: string | undefined) => {
                    resolve(editedData);
                },
            };
            modalStore.trigger(modal);
            // We got some kind of response from modal
        }).then((editedData: string | undefined) => {
            if (editedData) {
                cashuWallet!.name = editedData;
                updateWallet();
            }
        });
    }

    function deposit() {
        const modalComponent: ModalComponent = {
            ref: DepositEcashModal,
            props: { cashuWallet },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }

    function withdraw() {
        const modalComponent: ModalComponent = {
            ref: WithdrawEcashModal,
            props: { cashuWallet },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }

    function exploreMints() {
        // If user confirms modal do the editing
        new Promise<string[] | undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: ExploreMintsModal,
                props: { cashuWallet },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (mints?: string[]) => {
                    resolve(mints);
                },
            };
            modalStore.trigger(modal);
        }).then((mints) => {
            if (!cashuWallet || !mints || !mints.length) return;

            if (!arraysAreEqual(cashuWallet.mints, mints)) {
                cashuWallet.mints = mints;
            }

            updateWallet();
        });
    }

    function removeMint(mint: string) {
        if (!cashuWallet) return;

        cashuWallet.mints = cashuWallet.mints.filter((m) => m !== mint);

        updateWallet();
    }

    function addRelay() {
        // If user confirms modal do the editing
        new Promise<string | undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {
                    dataToEdit: 'wss://',
                    fieldName: 'Relay',
                    confirmButtonText: 'Add',
                },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (editedData: string | undefined) => {
                    resolve(editedData);
                },
            };
            modalStore.trigger(modal);
            // We got some kind of response from modal
        }).then((editedData: string | undefined) => {
            if (editedData) {
                if (!cashuWallet) return;

                const relays = [...cashuWallet.relays];
                relays.push(editedData);

                cashuWallet.relays = relays;

                updateWallet();
            }
        });
    }

    function removeRelay(relay: string) {
        if (!cashuWallet) return;

        cashuWallet.relays = cashuWallet.relays.filter((r) => r !== relay);

        updateWallet();
    }

    function refreshBalance() {
        if (!cashuWallet) return;

        cashuWallet.checkProofs();
    }

    async function backupWallet() {
        if (!cashuWallet) return;

        try {
            const tokenPromises = cashuWallet.tokens.map((token) => token.toNostrEvent());
            const tokens = await Promise.all(tokenPromises);

            // When user triggers manual backup its possible that
            // there are some tokens in svelte persisted store that are not in wallet
            // include those proofs too
            const tokenIds = tokens.map((t) => t.id);
            $cashuTokensBackup.forEach((value) => {
                if (!tokenIds.includes(value.id)) {
                    tokens.push(value);
                }
            });

            // Its also possible that there are some unsaved proofs in svelte persisted store
            // We need to include these proofs in backup too
            const unsavedProofsArray = Array.from($unsavedProofsBackup.entries());
            const unsavedProofsPromises = unsavedProofsArray.map(async ([mint, proofs]) => {
                if (proofs.length > 0) {
                    // Creating new cashu token for backing up unsaved proofs related to a specific mint
                    const newCashuToken = new NDKCashuToken($ndk);
                    newCashuToken.proofs = proofs;
                    newCashuToken.mint = mint;
                    newCashuToken.wallet = cashuWallet!;
                    newCashuToken.created_at = Math.floor(Date.now() / 1000);
                    newCashuToken.pubkey = $currentUser!.pubkey;

                    console.log('Encrypting proofs added to token event');
                    newCashuToken.content = JSON.stringify({
                        proofs: newCashuToken.proofs,
                    });

                    // encrypt the new token event
                    await newCashuToken.encrypt($currentUser!, undefined, 'nip44');
                    const cashuTokenEvent = await newCashuToken.toNostrEvent();
                    tokens.push(cashuTokenEvent);
                }
            });

            await Promise.all(unsavedProofsPromises);

            cashuWallet.event.tags = cashuWallet.publicTags;
            cashuWallet.event.content = JSON.stringify(cashuWallet.privateTags);
            await cashuWallet.event.encrypt($currentUser!, undefined, 'nip44');

            const json = {
                wallet: cashuWallet.event.rawEvent(),
                tokens,
            };

            const stringified = JSON.stringify(json, null, 2);

            localStorage.setItem('wallet-backup', stringified);
            saveToFile(stringified);
        } catch (error) {
            console.error('An error occurred in encryption of wallet content', error);
            toastStore.trigger({
                message: `Failed to backup! An error occurred in backup process.`,
                background: `bg-error-300-600-token`,
            });
        }
    }

    // Function to save encrypted content to a file
    function saveToFile(content: string) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        // Create a link element to trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wallet-backup.json';
        a.click();

        // Clean up
        URL.revokeObjectURL(url);
    }

    async function recoverWallet() {
        const modalComponent: ModalComponent = {
            ref: RecoverEcashWallet,
            props: { cashuWallet },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }

    const tooltipRemoveMint: PopupSettings = {
        event: 'hover',
        target: 'tooltipRemoveMint',
        placement: 'top-end',
    };

    const tooltipRemoveRelay: PopupSettings = {
        event: 'hover',
        target: 'tooltipRemoveRelay',
        placement: 'top-end',
    };

    const popupClasses = 'card w-60 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto';
</script>

<div class="flex flex-col gap-y-4 items-center p-4">
    <!-- Warning Banner -->
    {#if $displayEcashWarning}
        <Warning
            on:close={() => ($displayEcashWarning = false)}
            text="Attention: This is an experimental feature, use it at your own risk."
        />
    {/if}

    <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
        <div class="card p-4 bg-surface-200-700-token flex flex-col flex-grow gap-y-4">
            {#if !cashuWallet}
                <div class="flex justify-center">
                    <button
                        on:click={setupWallet}
                        type="button"
                        class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                    >
                        Initialize Cashu Wallet
                    </button>
                </div>
            {:else}
                <div class="flex items-center justify-center gap-x-4">
                    <h2 class="h2 text-center font-bold text-lg sm:text-2xl">
                        {cashuWallet.name || '??'}
                    </h2>

                    <button class="justify-self-end" on:click={editName}>
                        <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-xl" />
                    </button>
                </div>

                <div class="flex flex-col items-center">
                    <div class="flex items-baseline">
                        <div class="text-7xl font-black text-center focus:outline-none w-full">
                            {walletBalance}
                        </div>
                        <!-- <button on:click={refreshBalance}>
                            <i
                                class="fa-solid fa-rotate-right text-3xl text-muted-foreground font-light"
                            ></i>
                        </button> -->
                    </div>
                    <div class="text-3xl text-muted-foreground font-light">
                        {walletUnit}
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row sm:justify-center gap-4">
                    <button
                        on:click={deposit}
                        type="button"
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                    >
                        Deposit
                    </button>
                    <button
                        on:click={withdraw}
                        type="button"
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                    >
                        Withdraw
                    </button>
                    <button
                        on:click={backupWallet}
                        type="button"
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                    >
                        Backup
                    </button>
                    <button
                        on:click={recoverWallet}
                        type="button"
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                    >
                        Recover
                    </button>
                </div>

                <div class="flex flex-col items-center gap-y-2">
                    <div class="h3 font-bold text-lg">Mints</div>

                    {#if cashuWallet.mints.length > 0}
                        <!-- Scrollable Mint List -->
                        <div
                            class="max-h-24 w-full overflow-y-auto border border-gray-300 p-2 rounded"
                        >
                            {#each cashuWallet.mints as mint (mint)}
                                <div
                                    class="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded"
                                >
                                    <span>{mint}</span>
                                    <button
                                        on:click={() => removeMint(mint)}
                                        use:popup={tooltipRemoveMint}
                                        aria-label="Remove Mint"
                                    >
                                        <TrashIcon extraClasses="text-red-700" />
                                    </button>
                                    <div data-popup="tooltipRemoveMint">
                                        <div class={popupClasses}>
                                            <p>Remove Mint</p>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div>No mint found</div>
                    {/if}

                    <button
                        type="button"
                        on:click={exploreMints}
                        class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                    >
                        Explore Mints
                    </button>
                </div>

                <div class="flex flex-col items-center gap-y-2">
                    <div class="h3 font-bold text-lg">Relays</div>

                    <!-- Scrollable Mint List -->
                    <div class="max-h-36 w-full overflow-y-auto border border-gray-300 p-2 rounded">
                        {#each cashuWallet.relays as relay (relay)}
                            <div
                                class="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded"
                            >
                                <span>{relay}</span>
                                <button
                                    on:click={() => removeRelay(relay)}
                                    use:popup={tooltipRemoveRelay}
                                    aria-label="Remove Relay"
                                >
                                    <TrashIcon extraClasses="text-red-700" />
                                </button>
                                <div data-popup="tooltipRemoveRelay">
                                    <div class={popupClasses}>
                                        <p>Remove Relay</p>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <button
                        on:click={addRelay}
                        type="button"
                        class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                    >
                        Add Relay
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>
