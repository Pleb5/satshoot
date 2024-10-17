<script lang="ts">
    import ndk, { DEFAULTRELAYURLS } from '$lib/stores/ndk';
    import { cashuPaymentInfoMap, wallet } from '$lib/stores/wallet';
    import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
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
    import { NDKCashuMintList, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
    import WithdrawEcashModal from '$lib/components/Modals/WithdrawEcashModal.svelte';
    import currentUser from '$lib/stores/user';

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

            cashuMintList
                .publishReplaceable()
                .then(() => {
                    const t: ToastSettings = {
                        message: `Cashu Payment Info updated!`,
                    };
                    toastStore.trigger(t);

                })
                .catch((err) => {
                    console.error(err);
                    const t: ToastSettings = {
                        message: `Failed to update Cashu Payment Info : ${err}`,
                    };
                    toastStore.trigger(t);
                });
        }
    }

    async function updateWallet() {
        try {
            await cashuWallet!.publish();

            wallet.set(cashuWallet);

            const t: ToastSettings = {
                message: `Walled updated!`,
            };
            toastStore.trigger(t);
        } catch (e) {
            console.error(e);
            console.trace(e);
            const t: ToastSettings = {
                message: `Wallet update failed! Reason: ${e}`,
            };
            toastStore.trigger(t);
        }
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

            const existingMints = cashuWallet.mints;
            const newMints = mints.filter((mint) => !existingMints.includes(mint));

            if (!newMints.length) return;

            cashuWallet.mints = [...existingMints, ...newMints];
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
                props: { dataToEdit: 'wss://', fieldName: 'Relay' },
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

                <div class="flex justify-center gap-x-12">
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
