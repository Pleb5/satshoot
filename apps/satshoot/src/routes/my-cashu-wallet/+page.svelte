<script lang="ts">
    import ExploreMintsModal from '$lib/components/Modals/ExploreMintsModal.svelte';
    import RecoverEcashWallet from '$lib/components/Modals/RecoverEcashWallet.svelte';
    import { displayEcashWarning } from '$lib/stores/gui';
    import ndk, { blastrUrl, DEFAULTRELAYURLS } from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import {
        cashuPaymentInfoMap,
        ndkWalletService,
        wallet,
        WalletStatus,
        walletStatus,
    } from '$lib/stores/wallet';
    import { backupWallet, cleanWallet } from '$lib/utils/cashu';
    import { arraysAreEqual, fetchUserOutboxRelays, getCashuPaymentInfo } from '$lib/utils/helpers';
    import {
        NDKCashuMintList,
        NDKKind,
        NDKPrivateKeySigner,
        NDKRelayList,
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
    } from '@nostr-dev-kit/ndk';
    import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import {
        getModalStore,
        getToastStore,
        popup,
        ProgressRadial,
        type ModalComponent,
        type ModalSettings,
        type PopupSettings,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import EditProfileModal from '../../lib/components/Modals/EditProfileModal.svelte';
    import ImportEcashWallet from '$lib/components/Modals/ImportEcashWallet.svelte';
    import BackupEcashWallet from '$lib/components/Modals/BackupEcashWallet.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import WithdrawEcash from '$lib/components/Wallet/WithdrawEcash.svelte';
    import DepositEcash from '$lib/components/Wallet/DepositEcash.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import AddRelayModal from '$lib/components/Modals/AddRelayModal.svelte';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    let cashuWallet: NDKCashuWallet | null = null;

    $: if ($wallet) {
        cashuWallet = $wallet;
    }

    let walletBalance = 0;
    let walletUnit = 'sats';
    let cleaningWallet = false;

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

    $: if (!cashuWallet && $currentUser && $ndkWalletService) {
        (async () => {
            const relayUrls = [...$ndk.pool.urls()];

            const relayListEvent = await fetchUserOutboxRelays($ndk);
            if (relayListEvent) {
                const relayList = NDKRelayList.from(relayListEvent);
                relayUrls.push(...relayList.writeRelayUrls);
            }

            const walletEvent = await $ndk.fetchEvent(
                { kinds: [NDKKind.CashuWallet], authors: [$currentUser.pubkey] },
                { cacheUsage: NDKSubscriptionCacheUsage.PARALLEL },
                NDKRelaySet.fromRelayUrls(relayUrls, $ndk)
            );

            if (!walletEvent) {
                walletStatus.set(WalletStatus.Failed);
                return;
            }

            const wallet = await NDKCashuWallet.from(walletEvent);

            if (!wallet) {
                walletStatus.set(WalletStatus.Failed);
                return;
            }

            if (!$ndkWalletService.defaultWallet) {
                $ndkWalletService.defaultWallet = wallet;
                $ndkWalletService.emit('wallet:default', wallet);
            }
        })();
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

    async function importWallet() {
        const modalComponent: ModalComponent = {
            ref: ImportEcashWallet,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
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
                ref: AddRelayModal,
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

    function handleCleanWallet() {
        const modalBody = `
                <strong class="text-primary-400-500-token">
                    If a wallet contains used tokens, they will be removed
                    and you may see a decrease in wallet balance.
                    Do you really wish to clean wallet?
                </strong>`;

        let response = async function (r: boolean) {
            if (r) {
                modalStore.close();
                cleaningWallet = true;
                await cleanWallet(cashuWallet!)
                    .then((cleanedAmount) => {
                        toastStore.trigger({
                            message: `${cleanedAmount} spent/duplicate sats cleaned from wallet`,
                            background: `bg-success-300-600-token`,
                            autohide: false,
                        });
                    })
                    .catch((err) => {
                        console.error('An error occurred in cleaning wallet', err);
                        toastStore.trigger({
                            message: `Failed to clean used tokens!`,
                            background: `bg-info-300-600-token`,
                        });
                    })
                    .finally(() => {
                        cleaningWallet = false;
                    });
            }
        };

        const modal: ModalSettings = {
            type: 'confirm',
            // Data
            title: 'Confirm clean wallet',
            body: modalBody,
            response: response,
        };

        modalStore.trigger(modal);
    }

    async function handleWalletBackup() {
        if (!cashuWallet) return;

        const modalComponent: ModalComponent = {
            ref: BackupEcashWallet,
            props: { cashuWallet },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
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

    enum Tab {
        Mints,
        Relays,
    }

    let selectedTab = Tab.Mints;

    const tabs = [
        {
            id: Tab.Mints,
            label: 'Mints',
        },
        {
            id: Tab.Relays,
            label: 'Relays',
        },
    ];

    const popupClasses = 'card w-60 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto';

    const listItemWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row gap-[10px] justify-between rounded-[6px] ' +
        'bg-black-100 items-center overflow-hidden max-[576px]:gap-[0px] max-[576px]:flex-col hover:bg-blue-500 group';

    const listItemClasses =
        'transition ease duration-[0.3s] grow-[1] group-hover:text-white pl-[10px] break-all max-[576px]:py-[5px]';

    const deleteButtonClasses =
        'min-w-[50px] min-h-[35px] h-full justify-center items-center bg-white-0 text-black-500 max-[576px]:w-full ' +
        'group-hover:bg-white-200 group-hover:text-white-800 dark:text-white-500';

    const deleteIconClasses =
        'bx bxs-trash transition ease duration-[0.3s] h-full w-full flex h-full justify-center items-center hover:bg-red-400';
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <div class="w-full flex flex-col justify-center items-center py-[50px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[35px] max-[576px]:gap-[25px]">
                <!-- Wallet card end -->
                {#if $displayEcashWarning}
                    <Card classes="bg-warning-500 dark:bg-warning-700 hidden max-[768px]:flex">
                        <p class="font-[600] text-black-400">
                            Attention: This is an experimental feature, use it at your own risk.
                        </p>
                        <Button
                            variant="text"
                            classes="absolute top-[3px] right-[3px] p-[1px] text-black-400 hover:text-black-500"
                            on:click={() => ($displayEcashWarning = false)}
                        >
                            <i class="bx bx-x" />
                        </Button>
                    </Card>
                {/if}
                {#if $walletStatus === WalletStatus.Loading}
                    <div class="flex justify-center">
                        <ProgressRadial
                            value={undefined}
                            stroke={60}
                            meter="stroke-primary-500"
                            track="stroke-primary-500/30"
                            strokeLinecap="round"
                            width="w-8"
                        />
                    </div>
                {:else if $walletStatus === WalletStatus.Failed}
                    <div class="flex flex-col sm:flex-row sm:justify-center gap-4">
                        <button
                            on:click={setupWallet}
                            type="button"
                            class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                        >
                            Initialize Cashu Wallet
                        </button>
                        <button
                            on:click={importWallet}
                            type="button"
                            class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                        >
                            Import Wallet
                        </button>
                    </div>
                {:else if cashuWallet}
                    <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col">
                        <!-- wallet side -->
                        <div
                            class="w-full max-w-[350px] relative flex flex-col gap-[25px] max-[768px]:max-w-full"
                        >
                            <div
                                class="w-full flex flex-col gap-[15px] relative max-[768px]:mt-[15px]"
                            >
                                <!-- Wallet card start -->
                                <Card classes="gap-[15px]">
                                    <div
                                        class="w-full flex flex-col p-[10px] rounded-[6px] overflow-hidden relative min-h-[100px] bg-gradient-to-tl from-blue-500 to-blue-400 shadow-deep"
                                    >
                                        <div
                                            class="flex flex-row gap-[10px] font-[500] text-white-500 justify-between"
                                        >
                                            <p>{cashuWallet.name || '??'}</p>
                                            <Button
                                                variant="text"
                                                classes="bg-white-0 hover:bg-white-300 hover:text-black-400"
                                                on:click={editName}
                                            >
                                                <i class="bx bxs-edit" />
                                            </Button>
                                        </div>
                                        <p class="text-[24px] font-[500] text-white">
                                            {walletBalance}
                                        </p>
                                        <span
                                            class="text-[16px] opacity-[0.5] font-[500] text-white-800 mt-[-5px]"
                                        >
                                            sats
                                        </span>
                                        <i
                                            class="bx bxs-wallet text-white-50 text-[75px] absolute bottom-[-35px] right-[-10px] scale-[1.5] rotate-[-25deg]"
                                        />
                                    </div>
                                    <WithdrawEcash {cashuWallet} />
                                    <DepositEcash {cashuWallet} />
                                    <div
                                        class="w-full flex flex-row justify-end overflow-hidden rounded-[6px] bg-black-100 dark:bg-white-100 border-[1px] border-black-200 dark:border-white-200"
                                    >
                                        <Button
                                            variant="text"
                                            classes="p-[5px] gap-[5px] text-black-500  dark:text-white-500"
                                            grow
                                            on:click={handleWalletBackup}
                                        >
                                            <i class="bx bx-download" />
                                            Backup
                                        </Button>
                                        <Button
                                            variant="text"
                                            classes="p-[5px] gap-[5px] text-black-500  dark:text-white-500"
                                            grow
                                            on:click={recoverWallet}
                                        >
                                            <i class="bx bx-upload" />
                                            Recover
                                        </Button>
                                        <Button
                                            variant="text"
                                            classes="p-[5px] gap-[5px] text-black-500  dark:text-white-500"
                                            grow
                                            on:click={handleCleanWallet}
                                        >
                                            <i class="bx bx-rotate-left" />
                                            Clear Wallet
                                        </Button>
                                    </div>
                                </Card>
                                <!-- Wallet card end -->
                                {#if $displayEcashWarning}
                                    <Card
                                        classes="bg-warning-500 dark:bg-warning-700 relative max-[768px]:hidden"
                                    >
                                        <p class="font-[600] text-black-400">
                                            Attention: This is an experimental feature, use it at
                                            your own risk.
                                        </p>
                                        <Button
                                            variant="text"
                                            classes="absolute top-[3px] right-[3px] p-[1px] text-black-400 hover:text-black-500"
                                            on:click={() => ($displayEcashWarning = false)}
                                        >
                                            <i class="bx bx-x" />
                                        </Button>
                                    </Card>
                                {/if}
                            </div>
                        </div>
                        <!-- wallet side -->
                        <div class="w-full flex flex-col gap-[15px] relative">
                            <TabSelector {tabs} bind:selectedTab />
                            <div class="w-full flex flex-col">
                                {#if selectedTab === Tab.Mints}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <Card>
                                            <div class="w-full flex flex-row justify-end">
                                                <Button on:click={exploreMints}>
                                                    Explore Mints
                                                </Button>
                                            </div>
                                            <div
                                                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                                            >
                                                {#each cashuWallet.mints as mint (mint)}
                                                    <div class={listItemWrapperClasses}>
                                                        <p class={listItemClasses}>
                                                            {mint}
                                                        </p>
                                                        <button
                                                            class={deleteButtonClasses}
                                                            on:click={() => removeMint(mint)}
                                                            use:popup={tooltipRemoveMint}
                                                            aria-label="Remove Mint"
                                                        >
                                                            <i class={deleteIconClasses} />
                                                        </button>
                                                    </div>
                                                {/each}
                                            </div>
                                        </Card>
                                    </div>
                                {:else}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <Card>
                                            <div class="w-full flex flex-row justify-end">
                                                <Button on:click={addRelay}>Add Relay</Button>
                                            </div>
                                            <div
                                                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                                            >
                                                {#each cashuWallet.relays as relay (relay)}
                                                    <div class={listItemWrapperClasses}>
                                                        <p class={listItemClasses}>
                                                            {relay}
                                                        </p>
                                                        <button
                                                            class={deleteButtonClasses}
                                                            on:click={() => removeRelay(relay)}
                                                            use:popup={tooltipRemoveRelay}
                                                            aria-label="Remove Relay"
                                                        >
                                                            <i class={deleteIconClasses} />
                                                        </button>
                                                    </div>
                                                {/each}
                                            </div>
                                        </Card>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
