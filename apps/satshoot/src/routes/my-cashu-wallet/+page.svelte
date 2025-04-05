<script lang="ts">
    import ExploreMintsModal from '$lib/components/Modals/ExploreMintsModal.svelte';
    import RecoverEcashWallet from '$lib/components/Modals/RecoverEcashWallet.svelte';
    import { displayEcashWarning } from '$lib/stores/gui';
    import ndk, { DEFAULTRELAYURLS } from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import {
        userCashuInfo,
        wallet,
        walletInit,
        walletStatus,
    } from '$lib/wallet/wallet';
    import { arraysAreEqual, broadcastEvent, fetchAndInitWallet, fetchUserOutboxRelays, getCashuPaymentInfo } from '$lib/utils/helpers';
    import {
        NDKCashuMintList,
        NDKKind,
        NDKRelayList,
        NDKRelaySet,
        tryNormalizeRelayUrl,
    } from '@nostr-dev-kit/ndk';
    import { consolidateMintTokens, migrateCashuWallet, NDKCashuWallet, NDKWalletStatus, type WalletProofChange } from '@nostr-dev-kit/ndk-wallet';
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
    import BackupEcashWallet from '$lib/components/Modals/BackupEcashWallet.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import WithdrawEcash from '$lib/components/Wallet/WithdrawEcash.svelte';
    import DepositEcash from '$lib/components/Wallet/DepositEcash.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import AddRelayModal from '$lib/components/Modals/AddRelayModal.svelte';
    import PieChart from '$lib/components/UI/Display/PieChart.svelte';
    import RelayRemovalConfirmation from '$lib/components/Modals/RelayRemovalConfirmation.svelte';
    import RemoveMintModal from '$lib/components/Modals/RemoveMintModal.svelte';

    const toastStore = getToastStore();
    const modalStore = getModalStore();


    let mintBalances: Record<string, number> = $state({});
    let walletBalance = $state('0');
    let cleaningWallet = $state(false);
    let toastTriggered = false;

    enum Tab {
        Mints,
        Relays,
    }

    let selectedTab = $state(Tab.Mints);

    const tabs = [
        {
            id: Tab.Mints,
            label: 'My Mints',
        },
        {
            id: Tab.Relays,
            label: 'Wallet Relays',
        },
    ];

    const walletRelays = $derived($userCashuInfo?.relays ?? []);


    $effect(() => {
        if ($wallet && $userCashuInfo) {

            checkLegacyWallet();

            checkP2PK();

            mintBalances = $wallet.mintBalances;

            walletBalance = getBalanceStr($wallet)

            $wallet.on('balance_updated', () => {
                mintBalances = $wallet!.mintBalances;
                walletBalance = getBalanceStr($wallet!);
            });
        } else if (!$userCashuInfo) {
            reFetchCashuInfo();
        }
    });

    const checkLegacyWallet = async () => {
        if (!$wallet || !$userCashuInfo) return;

        let respondedToAction = false;

        if ($wallet.event?.kind === NDKKind.LegacyCashuWallet && !toastTriggered) {
            toastTriggered = true;
            const t: ToastSettings = {
                message:
                'You are using a legacy Nostr Wallet. Migrate to new?',
                background: 'bg-warning-300-600-token',
                autohide: false,
                action: {
                    label: 'Migrate',
                    response: () => {
                        respondedToAction = true;
                        migrateCashuWallet($ndk)
                            .then(() => {
                                toastStore.trigger({
                                    message: `Successfully migrated Wallet`,
                                    timeout: 5000,
                                    autohide: true,
                                    background: `bg-success-300-600-token`,
                                });
                            })
                            .catch((err) => {
                                toastStore.trigger({
                                    message: `Failed to migrate Wallet!\n ${err}`,
                                    autohide: false,
                                    background: `bg-error-300-600-token`,
                                });
                            });
                    },
                },
                callback: (res) => {
                    if (res.status === 'closed' && !respondedToAction) {
                        toastStore.trigger({
                            message: `You'll continue using legacy Wallet!`,
                            autohide: false,
                            background: `bg-warning-300-600-token`,
                        });
                    }
                },
            };
            toastStore.trigger(t);
        }
    }

    const checkP2PK = async () => {
        if (!$wallet || !$userCashuInfo) return;
        if (!$wallet._p2pk) {
            console.error('BUG: Wallet should have P2PK at this point!', $wallet)
            await $wallet.getP2pk();
        }

        let respondedToAction = false;
        if ($wallet._p2pk !== $userCashuInfo.p2pk && !respondedToAction) {
            console.log(`wallet _p2pk: ${$wallet._p2pk}\ncashuInfo p2pk:${$userCashuInfo.p2pk}`)
            const t: ToastSettings = {
                message:
                'Receiver Cashu info does not match with Nostr Wallet info.' +
                ' It is recommended to sync them.',
                background: 'bg-warning-300-600-token',
                autohide: false,
                action: {
                    label: 'Sync',
                    response: async () => {
                        respondedToAction = true;
                        try {
                            await syncP2PK();
                            toastStore.trigger({
                                message: `Successfully updated Cashu Info!`,
                                timeout: 5000,
                                autohide: true,
                                background: `bg-success-300-600-token`,
                            });
                        } catch (err) {
                            toastStore.trigger({
                                message: `Failed to update cashu mint list!`,
                                autohide: false,
                                background: `bg-error-300-600-token`,
                            });
                        }
                    },
                },
                callback: (res) => {
                    if (res.status === 'closed' && !respondedToAction) {
                        respondedToAction = true;
                        toastStore.trigger({
                            message: `You'll not be able to receive ecash payments`,
                            autohide: false,
                            background: `bg-warning-300-600-token`,
                        });
                    }
                },
            };
            toastStore.trigger(t);
        }
    }

    const syncP2PK = async () => {
        if (!$wallet || !$userCashuInfo) return;

        $userCashuInfo.p2pk = $wallet._p2pk;
        await broadcastEvent($ndk, $userCashuInfo, {replaceable: true})
    }

    const reFetchCashuInfo = async () => {
        if (!$currentUser || !$wallet) return

        const cashuInfo = await getCashuPaymentInfo($currentUser.pubkey, true);
        if (cashuInfo) {
            walletInit(
                $wallet,
                cashuInfo as NDKCashuMintList,
                $ndk,
                $currentUser
            );
            return;
        } else {
            tryCreateCashuInfo();
        }
    }

    const tryCreateCashuInfo = async () => {
        let respondedToAction = false;

        const t: ToastSettings = {
            message:
            'Could not find Cashu Info to receive ecash payments. Would you like' +
                ' to publish preferred receiver info based on your Nostr Wallet?',
            background: 'bg-warning-300-600-token',
            autohide: false,
            action: {
                label: 'Publish',
                response: async () => {
                    respondedToAction = true;

                    const ndkMintList = new NDKCashuMintList($wallet!.ndk);
                    let relays = DEFAULTRELAYURLS;
                    if ($wallet?.relaySet?.relayUrls) {
                        relays = $wallet.relaySet.relayUrls
                    }

                    ndkMintList.relays = relays;
                    ndkMintList.mints = $wallet!.mints;
                    ndkMintList.p2pk = $wallet!.p2pk;
                    try {
                        await broadcastEvent($ndk, ndkMintList, {replaceable: true})
                        walletInit($wallet!, ndkMintList, $ndk, $currentUser!);

                        toastStore.trigger({
                            message: `Successfully published Cashu Info`,
                            timeout: 5000,
                            autohide: true,
                            background: `bg-success-300-600-token`,
                        });
                    } catch (err) {
                        toastStore.trigger({
                            message: `Error happened while publishing Cashu Info:\n${err}`,
                            autohide: false,
                            background: `bg-error-300-600-token`,
                        });
                    }
                },
            },
            callback: (res) => {
                if (res.status === 'closed' && !respondedToAction) {
                    toastStore.trigger({
                        message: `You'll not be able to receive Cashu payments`,
                        autohide: false,
                        background: `bg-warning-300-600-token`,
                    });
                }
            },
        };
        toastStore.trigger(t);
    }

    function getBalanceStr($wallet: NDKCashuWallet): string {
        let balanceStr: string = ''
        const totalBalance = $wallet.balance;
        if (totalBalance) {
            balanceStr = totalBalance.amount.toString();
        } else {
            balanceStr = '?';
        }
        return balanceStr;
    }


    async function setupWallet() {
        const newWallet = new NDKCashuWallet($ndk);
        const mintPromise = new Promise<string[] | undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: ExploreMintsModal,
                props: { $wallet: newWallet },
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

        try {
            await newWallet.getP2pk();

            let mintRelays = DEFAULTRELAYURLS;
            const userRelays = await fetchUserOutboxRelays($ndk, $currentUser!.pubkey);
            if (userRelays) {
                const writeRelayList = NDKRelayList.from(userRelays).writeRelayUrls;
                if (writeRelayList.length > 0) {
                    mintRelays = [ ...mintRelays, ...writeRelayList];
                }
            }

            newWallet.relaySet = NDKRelaySet.fromRelayUrls(
                mintRelays, $ndk
            );

            const cashuInfo = new NDKCashuMintList($ndk);
            cashuInfo.p2pk = newWallet._p2pk;
            cashuInfo.relays = mintRelays;
            cashuInfo.mints = newWallet.mints;

            await broadcastEvent($ndk, cashuInfo, {replaceable: true})
            await newWallet.publish();

            const t: ToastSettings = {
                message: `Nostr Wallet created!`,
            };
            toastStore.trigger(t);

            walletInit(newWallet, cashuInfo, $ndk, $currentUser!);
        } catch (err) {
            console.error(err);
            const t: ToastSettings = {
                message: `Failed to create Nostr Wallet: ${err}`,
            };
            toastStore.trigger(t);
        }
    }

    async function tryLoadWallet() {
        if ($currentUser) {
            await fetchAndInitWallet($currentUser, $ndk);
            if ($wallet){
                $wallet = $wallet;
            } else {
            toastStore.trigger({
                message: `Could not load wallet!`,
                autohide: false,
                background: `bg-error-300-600-token`,
            });
            }
        } else {
            toastStore.trigger({
                message: `Error: User not found!`,
                autohide: false,
                background: `bg-error-300-600-token`,
            });
        }
    }

    async function updateMints(mints: string[]) {
        try {
            if (!$wallet || !$userCashuInfo){
                throw new Error('Wallet or user Cashu information missing!')
            }

            $wallet.mints = mints
            await $wallet.publish();
            wallet.set($wallet);

            $userCashuInfo.mints = $wallet.mints;

            await broadcastEvent($ndk, $userCashuInfo, {replaceable: true})


            toastStore.trigger({
                message: `Mints updated!`,
            });
        } catch (e) {
            console.trace(e);
            toastStore.trigger({
                message: `Wallet update failed! Reason: ${e}`,
                background: 'bg-error-300-600-token'
            });
        }
    }


    function exploreMints() {
        // If user confirms modal do the editing
        new Promise<string[] | undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: ExploreMintsModal,
                props: { $wallet },
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
            if (!$wallet || !mints || !mints.length) return;

            if (!arraysAreEqual($wallet.mints, mints)) {
                updateMints(mints);
            }

        });
    }

    function removeMint(mint: string) {
        if (!$wallet) return;

        modalStore.trigger({
            type: 'component',
            component: {
                ref: RemoveMintModal,
                props: {
                    mint,
                    onConfirm: () => {
                        handleRemoveMint(mint);
                    },
                },
            },
        });
    }

    function handleRemoveMint(mint: string) {
        if (!$wallet) return

        updateMints(
            $wallet.mints.filter((m) => m !== mint)
        );
    }

    function addRelay() {
        if (!$wallet || !$userCashuInfo) return;

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
        }).then(async (editedData: string | undefined) => {
                if (editedData && editedData.replace('wss://', '').length > 1) {
                    const relayUrl = tryNormalizeRelayUrl(editedData);
                    if (relayUrl) {
                        $userCashuInfo.relays = [...$userCashuInfo.relays, editedData];
                        if ($wallet!.relaySet) {
                            $wallet!.relaySet = NDKRelaySet.fromRelayUrls(
                                $userCashuInfo.relays, $ndk
                            );
                        }

                        await broadcastEvent($ndk, $userCashuInfo, {replaceable: true})
                        const t: ToastSettings = {
                            message: `Cashu Info updated!`,
                        };
                        toastStore.trigger(t);
                    } else {
                        const t: ToastSettings = {
                            message: `Invalid Relay URL!`,
                            autohide: false,
                            background: 'bg-error-300-600-token'
                        };
                        toastStore.trigger(t);
                    }
                }
        });
    }

    function removeRelay(relay: string) {
        modalStore.trigger({
            type: 'component',
            component: {
                ref: RelayRemovalConfirmation,
                props: {
                    url: relay,
                    onConfirm: () => {
                        handleRemoveRelay(relay);
                    },
                },
            },
        });

    }

    async function handleRemoveRelay(relay: string) {
        try {
            if (!$userCashuInfo?.relays) {
                throw new Error('Could not find info to update')
            }

            $userCashuInfo.relays = $userCashuInfo.relays.filter(
                (url:string) => url !== relay
            );

            if ($wallet?.relaySet?.relays) {
                $wallet.relaySet = NDKRelaySet.fromRelayUrls(
                    $userCashuInfo.relays, $ndk
                );
            }

            await broadcastEvent($ndk, $userCashuInfo, {replaceable: true});

            const t: ToastSettings = {
                message: `Cashu Info updated!`,
            };
            toastStore.trigger(t);
        } catch(err) {
            console.error(err);
            const t: ToastSettings = {
                message: `Failed to update Cashu Info : ${err}`,
            };
            toastStore.trigger(t);
            return;
        }
    }

    function handleCleanWallet() {
        if (!$wallet) {
            toastStore.trigger({
                message: `Error! Wallet not found!`,
                autohide: false,
                background: `bg-error-300-600-token`,
            });
            return;
        }
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
                const onCleaningResult = (walletChange:WalletProofChange) => {
                    let amountDestroyed = 0;
                    if (walletChange.destroy) {
                        for (const proof of walletChange.destroy) {
                            amountDestroyed += proof.amount;
                        }
                    }
                    toastStore.trigger({
                        message: `${amountDestroyed} spent sats cleaned from wallet`,
                        background: `bg-success-300-600-token`,
                        autohide: false,
                    });
                    }
                for (const mint of $wallet!.mints) {
                    try {
                        await consolidateMintTokens(
                            mint,
                            $wallet!,
                            undefined, // allProofs = wallet proofs implicitly
                            onCleaningResult
                        );
                    } catch(err) {
                        console.error('An error occurred in cleaning wallet', err);
                        toastStore.trigger({
                            message: `Failed to clean used tokens!`,
                            background: `bg-info-300-600-token`,
                        });
                    } finally {
                        cleaningWallet = false;
                    };
                }
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
        if (!$wallet) return;

        const modalComponent: ModalComponent = {
            ref: BackupEcashWallet,
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

    const listItemWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row gap-[10px] justify-between rounded-[6px] ' +
        'bg-black-100 items-center overflow-hidden max-[576px]:gap-[0px] max-[576px]:flex-col hover:bg-blue-500 group';

    const listItemClasses =
        'transition ease duration-[0.3s] grow-[1] group-hover:text-white pl-[10px] break-all max-[576px]:py-[5px]';

    const deleteButtonClasses =
        'min-w-[50px] min-h-[35px] h-full justify-center items-center bg-white-0 text-black-500 max-[576px]:w-full ' +
        'group-hover:bg-white-200 group-hover:text-white dark:text-white';

    const deleteIconClasses =
        'bx bxs-trash transition ease duration-[0.3s] h-full w-full flex h-full justify-center items-center hover:bg-red-400';
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <div class="w-full flex flex-col justify-center items-center py-4">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[35px] max-[576px]:gap-[25px]">
                <!-- Wallet card end -->
                {#if $displayEcashWarning}
                    <Card
                        classes="bg-warning-500 dark:bg-warning-700 hidden max-[768px]:flex relative"
                    >
                        <p class="font-[600] text-white">
                            Warning: Experimental feature, use at your own risk! LN payments will only appear in your LN wallet balance. This wallet only handles Cashu ecash!
                        </p>
                        <Button
                            variant="text"
                            classes="absolute top-[3px] right-[3px] p-[1px] text-black-400 hover:text-black-500"
                            on:click={() => ($displayEcashWarning = false)}
                        >
                            <i class="bx bx-x"> </i>
                        </Button>
                    </Card>
                {/if}
                {#if $walletStatus === NDKWalletStatus.INITIAL
                    || $walletStatus === NDKWalletStatus.LOADING
                }
                    <!-- Placeholder Section for desktop view -->

                    <section class="w-full max-[768px]:hidden grid grid-cols-3">
                        <div class="p-4 space-y-4">
                            <div class="placeholder animate-pulse"> </div>
                            <div class="grid grid-cols-3 gap-8">
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                            </div>
                            <div class="grid grid-cols-4 gap-4">
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                            </div>
                        </div>
                        <div class="col-span-2 p-4 space-y-4">
                            <div class="placeholder animate-pulse"> </div>
                            <div class="grid grid-cols-3 gap-8">
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                            </div>
                            <div class="grid grid-cols-4 gap-4">
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                                <div class="placeholder animate-pulse"> </div>
                            </div>
                        </div>
                    </section>

                    <!-- Placeholder Section for mobile view -->
                    {#each { length: 2 } as _}
                        <section class="w-full hidden max-[768px]:block">
                            <div class="p-4 space-y-4">
                                <div class="placeholder animate-pulse"> </div>
                                <div class="grid grid-cols-3 gap-8">
                                    <div class="placeholder animate-pulse"> </div>
                                    <div class="placeholder animate-pulse"> </div>
                                    <div class="placeholder animate-pulse"> </div>
                                </div>
                                <div class="grid grid-cols-4 gap-4">
                                    <div class="placeholder animate-pulse"> </div>
                                    <div class="placeholder animate-pulse"> </div>
                                    <div class="placeholder animate-pulse"> </div>
                                    <div class="placeholder animate-pulse"> </div>
                                </div>
                            </div>
                        </section>
                    {/each}
                {:else if $walletStatus === NDKWalletStatus.FAILED}
                    <div class="flex flex-col sm:flex-row sm:justify-center gap-4">
                        <Button on:click={setupWallet}>New Nostr Wallet</Button>
                        <Button on:click={tryLoadWallet}>Try loading Wallet</Button>
                    </div>
                {:else if $wallet}
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
                                            class="font-[500] text-white"
                                        >
                                            <p>'My Nostr Wallet'</p>
                                            
                                        </div>
                                        <p class="text-[24px] font-[500] text-white">
                                            {walletBalance}
                                            <span
                                                class="text-[16px] opacity-[0.5] font-[500] text-white mt-[-5px]"
                                            >
                                                sats
                                            </span>
                                        </p>

                                        <i
                                            class="bx bxs-wallet text-white-50 text-[75px] absolute bottom-[-35px] right-[-10px] scale-[1.5] rotate-[-25deg]">
                                        </i>
                                    </div>
                                    <PieChart dataset={mintBalances} />
                                    <WithdrawEcash cashuWallet = {$wallet} />
                                    <DepositEcash cashuWallet = {$wallet} />
                                    <div
                                        class="w-full flex flex-row justify-end overflow-hidden rounded-[6px] bg-black-100 dark:bg-white-100 border-[1px] border-black-200 dark:border-white-200"
                                    >
                                        <Button
                                            variant="text"
                                            classes="p-[5px] gap-[5px] text-black-500  dark:text-white"
                                            grow
                                            on:click={handleWalletBackup}
                                        >
                                            <i class="bx bx-download"> </i>
                                            Backup
                                        </Button>
                                        <Button
                                            variant="text"
                                            classes="p-[5px] gap-[5px] text-black-500  dark:text-white"
                                            grow
                                            on:click={recoverWallet}
                                        >
                                            <i class="bx bx-upload"> </i>
                                            Recover
                                        </Button>
                                        <Button
                                            variant="text"
                                            classes="p-[5px] gap-[5px] text-black-500  dark:text-white"
                                            grow
                                            on:click={handleCleanWallet}
                                        >
                                            {#if cleaningWallet}
                                                <ProgressRadial
                                                    value={undefined}
                                                    stroke={60}
                                                    meter="stroke-white-500"
                                                    track="stroke-white-500/3"
                                                    width="w-8"
                                                    strokeLinecap="round"
                                                />
                                            {:else}
                                                <i class="fa-solid fa-broom"></i>
                                                Clean
                                            {/if}
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
                                            <i class="bx bx-x"> </i>
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
                                            <div class="flex justify-center">
                                                <Button on:click={exploreMints}>
                                                    Explore Mints
                                                </Button>
                                            </div>
                                            <div
                                                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                                            >
                                                {#each $wallet.mints as mint (mint)}
                                                    <div class={listItemWrapperClasses}>
                                                        <p class={listItemClasses}>
                                                            {mint}
                                                        </p>
                                                        <button
                                                            class={deleteButtonClasses}
                                                            onclick={() => removeMint(mint)}
                                                            use:popup={tooltipRemoveMint}
                                                            aria-label="Remove Mint"
                                                        >
                                                            <i class={deleteIconClasses}> </i>
                                                        </button>
                                                    </div>
                                                {/each}
                                            </div>
                                        </Card>
                                    </div>
                                {:else if selectedTab === Tab.Relays}
                                    <div class="w-full flex flex-col gap-[10px]">
                                        <Card>
                                            <div class="w-full flex flex-row justify-end">
                                                <Button on:click={addRelay}>Add Relay</Button>
                                            </div>
                                            <div
                                                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                                            >
                                                {#if $walletStatus === NDKWalletStatus.READY}
                                                    {#each walletRelays as relay (relay)}
                                                        <div class={listItemWrapperClasses}>
                                                            <p class={listItemClasses}>
                                                                {relay}
                                                            </p>
                                                            <button
                                                                class={deleteButtonClasses}
                                                                onclick={() => removeRelay(relay)}
                                                                use:popup={tooltipRemoveRelay}
                                                                aria-label="Remove Relay"
                                                            >
                                                                <i class={deleteIconClasses}> </i>
                                                            </button>
                                                        </div>
                                                    {/each}
                                                {/if}
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
