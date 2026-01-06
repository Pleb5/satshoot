<script lang="ts">
    import ExploreMintsModal from '$lib/components/Modals/ExploreMintsModal.svelte';
    import RecoverEcashWallet from '$lib/components/Modals/RecoverEcashWallet.svelte';
    import { displayEcashWarning } from '$lib/stores/gui';
    import ndk, { DEFAULTRELAYURLS } from '$lib/stores/session';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import { userCashuInfo, wallet, walletInit, walletStatus } from '$lib/wallet/wallet';
    import {
        arraysAreEqual,
        broadcastEvent,
        fetchAndInitWallet,
        fetchUserOutboxRelays,
        getCashuPaymentInfo,
    } from '$lib/utils/helpers';
    import {
        NDKCashuMintList,
        NDKKind,
        NDKRelayList,
        NDKRelaySet,
        tryNormalizeRelayUrl,
    } from '@nostr-dev-kit/ndk';
    import {
        consolidateMintTokens,
        migrateCashuWallet,
        NDKCashuWallet,
        NDKWalletStatus,
        type WalletProofChange,
    } from '@nostr-dev-kit/ndk-wallet';

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
    import ConfirmationDialog from '$lib/components/UI/ConfirmationDialog.svelte';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { deriveSeedKey } from '$lib/wallet/nut-13';
    import MnemonicSeedGenerationModal from '$lib/components/Modals/MnemonicSeedGenerationModal.svelte';
    import MnemonicSeedInputModal from '$lib/components/Modals/MnemonicSeedInputModal.svelte';

    enum Tab {
        Mints,
        Relays,
    }

    let showAddRelayModal = $state(false);
    let showRelayRemovalConfirmation = $state(false);
    let relayToRemove = $state<string | null>(null);
    let showMintRemovalConfirmation = $state(false);
    let mintToRemove = $state<string | null>(null);
    let showMintModal = $state(false);
    let showExploreMintsModal = $state(false);
    let tempWallet = $state<NDKCashuWallet | null>(null);
    let showRecoverEcashWallet = $state(false);
    let showBackupEcashWallet = $state(false);
    let showCleanWalletConfirmationDialog = $state(false);
    let showMnemonicSeedGenerationModal = $state(false);
    let showMnemonicSeedInputModal = $state(false);

    let mintBalances: Record<string, number> = $state({});
    let walletBalance = $state('0');
    let cleaningWallet = $state(false);
    let toastTriggered = false;

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
        if (!$wallet) {
            tryLoadWallet();
            return;
        }
        if ($wallet && $userCashuInfo) {
            checkLegacyWallet();

            checkP2PK();

            mintBalances = $wallet.mintBalances;

            walletBalance = getBalanceStr($wallet);

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
            toaster.warning({
                title: 'You are using a legacy Nostr Wallet. Migrate to new?',
                duration: 60_000,
                action: {
                    label: 'Migrate',
                    onClick: () => {
                        respondedToAction = true;
                        migrateCashuWallet($ndk)
                            .then(() => {
                                toaster.success({
                                    title: `Successfully migrated Wallet`,
                                });
                            })
                            .catch((err) => {
                                toaster.error({
                                    title: `Failed to migrate Wallet!\n ${err}`,
                                });
                            });
                    },
                },
                onStatusChange: (res) => {
                    if (res.status === 'dismissing' && !respondedToAction) {
                        toaster.warning({
                            title: `You'll continue using legacy Wallet!`,
                        });
                    }
                },
            });
        }
    };

    const checkP2PK = async () => {
        if (!$wallet || !$userCashuInfo) return;
        if (!$wallet._p2pk) {
            console.error('BUG: Wallet should have P2PK at this point!', $wallet);
            await $wallet.getP2pk();
        }

        let respondedToAction = false;
        if ($wallet._p2pk !== $userCashuInfo.p2pk && !respondedToAction) {
            console.log(`wallet _p2pk: ${$wallet._p2pk}\ncashuInfo p2pk:${$userCashuInfo.p2pk}`);
            toaster.warning({
                title:
                    'Receiver Cashu info does not match with Nostr Wallet info.' +
                    ' It is recommended to sync them.',
                duration: 60000, // 1 min
                action: {
                    label: 'Sync',
                    onClick: async () => {
                        respondedToAction = true;
                        try {
                            await syncP2PK();
                            toaster.success({
                                title: `Successfully updated Cashu Info!`,
                            });
                        } catch (err) {
                            toaster.error({
                                title: `Failed to update cashu mint list!`,
                            });
                        }
                    },
                },
                onStatusChange: (res) => {
                    if (res.status === 'dismissing' && !respondedToAction) {
                        respondedToAction = true;
                        toaster.warning({
                            title: `You'll not be able to receive ecash payments`,
                        });
                    }
                },
            });
        }
    };

    const syncP2PK = async () => {
        if (!$wallet || !$userCashuInfo) return;

        $userCashuInfo.p2pk = $wallet._p2pk;
        await broadcastEvent($ndk, $userCashuInfo, { replaceable: true });
    };

    const reFetchCashuInfo = async () => {
        if (!$currentUser || !$wallet) return;

        const cashuInfo = await getCashuPaymentInfo($currentUser.pubkey, true);
        if (cashuInfo) {
            walletInit($wallet, cashuInfo as NDKCashuMintList, $ndk, $currentUser);
            return;
        } else {
            tryCreateCashuInfo();
        }
    };

    const tryCreateCashuInfo = async () => {
        let respondedToAction = false;

        toaster.warning({
            title:
                'Could not find Cashu Info to receive ecash payments. Would you like' +
                ' to publish preferred receiver info based on your Nostr Wallet?',
            action: {
                label: 'Publish',
                onClick: async () => {
                    respondedToAction = true;

                    const ndkMintList = new NDKCashuMintList($wallet!.ndk);
                    let relays = DEFAULTRELAYURLS;
                    if ($wallet?.relaySet?.relayUrls) {
                        relays = $wallet.relaySet.relayUrls;
                    }

                    ndkMintList.relays = relays;
                    ndkMintList.mints = $wallet!.mints;
                    ndkMintList.p2pk = $wallet!.p2pk;
                    try {
                        await broadcastEvent($ndk, ndkMintList, { replaceable: true });
                        walletInit($wallet!, ndkMintList, $ndk, $currentUser!);

                        toaster.success({
                            title: `Successfully published Cashu Info`,
                        });
                    } catch (err) {
                        toaster.error({
                            title: `Error happened while publishing Cashu Info:\n${err}`,
                        });
                    }
                },
            },
            onStatusChange: (res) => {
                if (res.status === 'dismissing' && !respondedToAction) {
                    toaster.warning({
                        title: `You'll not be able to receive Cashu payments`,
                    });
                }
            },
        });
    };

    function getBalanceStr($wallet: NDKCashuWallet): string {
        let balanceStr: string = '';
        const totalBalance = $wallet.balance;
        if (totalBalance) {
            balanceStr = totalBalance.amount.toString();
        } else {
            balanceStr = '?';
        }
        return balanceStr;
    }

    function setupNewWallet(bip39seed: Uint8Array) {
        tempWallet = new NDKCashuWallet($ndk, bip39seed);
        showMintModal = true;
    }

    function generateBip39Seed(newWallet: boolean): (seedWords: string[]) => void {
        return async (seedWords) => {
            const bip39seed = deriveSeedKey(seedWords.join(' '));
            if (newWallet) setupNewWallet(bip39seed);
            else await recoverDeterministicWallet(bip39seed);
        };
    }

    // Handler for new wallet mint selection
    function handleMintSelection(selectedMints: string[]) {
        if (!selectedMints?.length) {
            toaster.error({ title: `No mint is selected. Choose at-least 1 mint` });
            return;
        }

        if (tempWallet) {
            tempWallet.mints = selectedMints;
            continueWalletSetup(tempWallet);
        }
    }

    async function continueWalletSetup(newWallet: NDKCashuWallet) {
        try {
            await newWallet.getP2pk();

            let mintRelays = DEFAULTRELAYURLS;
            const userRelays = await fetchUserOutboxRelays($ndk, $currentUser!.pubkey);
            if (userRelays) {
                const writeRelayList = NDKRelayList.from(userRelays).writeRelayUrls;
                if (writeRelayList.length > 0) {
                    mintRelays = [...mintRelays, ...writeRelayList];
                }
            }

            newWallet.relaySet = NDKRelaySet.fromRelayUrls(mintRelays, $ndk);

            const cashuInfo = new NDKCashuMintList($ndk);
            cashuInfo.p2pk = newWallet._p2pk;
            cashuInfo.relays = mintRelays;
            cashuInfo.mints = newWallet.mints;

            await broadcastEvent($ndk, cashuInfo, { replaceable: true });
            await newWallet.publish();

            toaster.success({
                title: `Nostr Wallet created!`,
            });

            walletInit(newWallet, cashuInfo, $ndk, $currentUser!);
        } catch (err) {
            console.error(err);
            toaster.error({
                title: `Failed to create Nostr Wallet: ${err}`,
            });
        }
    }

    async function tryLoadWallet() {
        if ($currentUser) {
            await fetchAndInitWallet($currentUser, $ndk, {
                fetchLegacyWallet: true,
            });
            if ($wallet) {
                $wallet = $wallet;
            }
        } else if ($loggedIn) {
            console.error('Error: User not found!');
        }
    }

    // TODO (rodant)
    async function recoverDeterministicWallet(_bip39seed: Uint8Array): Promise<void> {
        return Promise.resolve();
    }

    async function updateMints(mints: string[]) {
        try {
            if (!$wallet || !$userCashuInfo) {
                throw new Error('Wallet or user Cashu information missing!');
            }

            $wallet.mints = mints;
            await $wallet.publish();
            wallet.set($wallet);

            $userCashuInfo.mints = $wallet.mints;

            await broadcastEvent($ndk, $userCashuInfo, { replaceable: true });

            toaster.success({
                title: `Mints updated!`,
            });
        } catch (e) {
            console.trace(e);
            toaster.error({
                title: `Wallet update failed! Reason: ${e}`,
            });
        }
    }

    function exploreMints() {
        showExploreMintsModal = true;
    }

    // Handler for existing wallet mint updates
    function handleMintsUpdate(selectedMints: string[]) {
        if (!$wallet || !selectedMints?.length) return;

        if (!arraysAreEqual($wallet.mints, selectedMints)) {
            updateMints(selectedMints);
        }
    }

    function removeMint(mint: string) {
        if (!$wallet) return;

        mintToRemove = mint;
        showMintRemovalConfirmation = true;
    }

    async function handleRemoveMint(mint: string) {
        if (!$wallet) return;

        await updateMints($wallet.mints.filter((m) => m !== mint));
    }

    function addRelay() {
        if (!$wallet || !$userCashuInfo) return;

        showAddRelayModal = true;
    }

    async function handleAddRelay(editedData: string) {
        if (!$wallet || !$userCashuInfo) return;

        if (editedData && editedData.replace('wss://', '').length > 1) {
            const relayUrl = tryNormalizeRelayUrl(editedData);
            if (relayUrl) {
                $userCashuInfo.relays = [...$userCashuInfo.relays, editedData];
                if ($wallet!.relaySet) {
                    $wallet!.relaySet = NDKRelaySet.fromRelayUrls($userCashuInfo.relays, $ndk);
                }

                await broadcastEvent($ndk, $userCashuInfo, { replaceable: true });
                toaster.success({
                    title: `Cashu Info updated!`,
                });
            } else {
                toaster.error({
                    title: `Invalid Relay URL!`,
                });
            }
        }
    }

    function removeRelay(relay: string) {
        if (!$wallet) return;

        relayToRemove = relay;
        showRelayRemovalConfirmation = true;
    }

    async function handleRemoveRelay(relay: string) {
        try {
            if (!$userCashuInfo?.relays) {
                throw new Error('Could not find info to update');
            }

            $userCashuInfo.relays = $userCashuInfo.relays.filter((url: string) => url !== relay);

            if ($wallet?.relaySet?.relays) {
                $wallet.relaySet = NDKRelaySet.fromRelayUrls($userCashuInfo.relays, $ndk);
            }

            await broadcastEvent($ndk, $userCashuInfo, { replaceable: true });

            toaster.success({
                title: `Cashu Info updated!`,
            });
        } catch (err) {
            console.error(err);
            toaster.error({
                title: `Failed to update Cashu Info : ${err}`,
            });
            return;
        }
    }

    function handleCleanWallet() {
        if (!$wallet) {
            toaster.error({
                title: `Error! Wallet not found!`,
            });
            return;
        }
        showCleanWalletConfirmationDialog = true;
    }

    async function cleanWallet() {
        cleaningWallet = true;

        const onCleaningResult = (walletChange: WalletProofChange) => {
            let amountDestroyed = 0;
            if (walletChange.destroy) {
                for (const proof of walletChange.destroy) {
                    amountDestroyed += proof.amount;
                }
            }
            toaster.success({
                title: `${amountDestroyed} spent sats cleaned from wallet`,
                duration: 60000, // 1 min
            });
        };

        for (const mint of $wallet!.mints) {
            try {
                await consolidateMintTokens(
                    mint,
                    $wallet!,
                    undefined, // allProofs = wallet proofs implicitly
                    onCleaningResult
                );
            } catch (err) {
                console.error('An error occurred in cleaning wallet', err);
                toaster.error({
                    title: `Failed to clean used tokens!`,
                });
            } finally {
                cleaningWallet = false;
            }
        }
    }

    async function handleWalletBackup() {
        if (!$wallet) return;

        showBackupEcashWallet = true;
    }

    async function recoverWallet() {
        showRecoverEcashWallet = true;
    }

    const listItemWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row gap-[10px] justify-between rounded-[6px] ' +
        'bg-black-100 items-center overflow-hidden max-[576px]:gap-[0px] max-[576px]:flex-col hover:bg-blue-500 group';

    const listItemClasses =
        'transition ease duration-[0.3s] grow-1 group-hover:text-white pl-[10px] break-all max-[576px]:py-[5px]';

    const deleteButtonClasses =
        'min-w-[50px] min-h-[35px] h-full justify-center items-center bg-white-0 text-black-500 max-[576px]:w-full ' +
        'group-hover:bg-white-200 group-hover:text-white dark:text-white';

    const deleteIconClasses =
        'bx bxs-trash transition ease duration-[0.3s] h-full w-full flex! h-full justify-center items-center hover:bg-red-400';
</script>

<div class="w-full flex flex-col gap-0 grow">
    <div class="w-full flex flex-col justify-center items-center py-4">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[35px] max-[576px]:gap-[25px]">
                <!-- Wallet card end -->
                {#if $displayEcashWarning}
                    <Card
                        classes="bg-warning-500 dark:bg-warning-700 hidden max-[768px]:flex relative"
                    >
                        <p class="font-[600] text-white">
                            Warning: Experimental feature, use at your own risk! LN payments will
                            only appear in your LN wallet balance. This wallet only handles Cashu
                            ecash!
                        </p>
                        <Button
                            variant="text"
                            classes="absolute top-[3px] right-[3px] p-[1px] text-black-400 hover:text-black-500"
                            onClick={() => ($displayEcashWarning = false)}
                            title="Dismiss warning"
                        >
                            <i class="bx bx-x"> </i>
                        </Button>
                    </Card>
                {/if}
                {#if $walletStatus === NDKWalletStatus.INITIAL || $walletStatus === NDKWalletStatus.LOADING}
                    <!-- Placeholder Section for desktop view -->

                    <section class="w-full max-[768px]:hidden grid grid-cols-3">
                        <div class="p-4 space-y-4">
                            <div class="placeholder animate-pulse"></div>
                            <div class="grid grid-cols-3 gap-8">
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                            </div>
                            <div class="grid grid-cols-4 gap-4">
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                            </div>
                        </div>
                        <div class="col-span-2 p-4 space-y-4">
                            <div class="placeholder animate-pulse"></div>
                            <div class="grid grid-cols-3 gap-8">
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                            </div>
                            <div class="grid grid-cols-4 gap-4">
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                                <div class="placeholder animate-pulse"></div>
                            </div>
                        </div>
                    </section>

                    <!-- Placeholder Section for mobile view -->
                    {#each { length: 2 } as _}
                        <section class="w-full hidden max-[768px]:block">
                            <div class="p-4 space-y-4">
                                <div class="placeholder animate-pulse"></div>
                                <div class="grid grid-cols-3 gap-8">
                                    <div class="placeholder animate-pulse"></div>
                                    <div class="placeholder animate-pulse"></div>
                                    <div class="placeholder animate-pulse"></div>
                                </div>
                                <div class="grid grid-cols-4 gap-4">
                                    <div class="placeholder animate-pulse"></div>
                                    <div class="placeholder animate-pulse"></div>
                                    <div class="placeholder animate-pulse"></div>
                                    <div class="placeholder animate-pulse"></div>
                                </div>
                            </div>
                        </section>
                    {/each}
                {:else if $walletStatus === NDKWalletStatus.FAILED}
                    <div class="flex flex-col sm:flex-row sm:justify-center gap-4">
                        <Button
                            onClick={() => showMnemonicSeedGenerationModal = true}
                            title="Create a new Nostr Cashu wallet"
                            >New Nostr Wallet</Button
                        >
                        <Button onClick={tryLoadWallet} title="Retry loading your wallet"
                            >Try loading Wallet</Button
                        >
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
                                <div class="max-w-[95vw]">
                                    <Card classes="gap-[15px]">
                                        <div
                                            class="w-full flex flex-col p-[10px] rounded-[6px] overflow-hidden relative min-h-[100px] bg-linear-to-tl from-blue-500 to-blue-400 shadow-deep"
                                        >
                                            <div class="font-[500] text-white">
                                                <p>Wallet</p>
                                            </div>
                                            <p class="text-[24px] font-[500] text-white">
                                                {walletBalance}
                                                <span
                                                    class="text-[16px] opacity-[0.5] font-[500] text-white mt-[-5px]"
                                                >
                                                    sats
                                                </span>
                                            </p>

                                            <!-- <i -->
                                            <!--         class="bx bxs-wallet text-white-50 text-[75px] absolute bottom-[-35px] right-[-10px] scale-[1.5] rotate-[-25deg]" -->
                                            <!--     > -->
                                            <!--     </i> -->
                                        </div>
                                        <PieChart dataset={mintBalances} />
                                        <WithdrawEcash cashuWallet={$wallet} />
                                        <DepositEcash cashuWallet={$wallet} />
                                        <div
                                            class="w-full flex flex-row justify-end overflow-hidden rounded-[6px] bg-black-100 dark:bg-white-100 border-[1px] border-black-200 dark:border-white-200"
                                        >
                                            <Button
                                                variant="text"
                                                classes="p-[5px] gap-[5px] text-black-500  dark:text-white"
                                                grow
                                                onClick={handleWalletBackup}
                                                title="Download an encrypted wallet backup"
                                            >
                                                <i class="bx bx-download"> </i>
                                                Backup
                                            </Button>
                                            <Button
                                                variant="text"
                                                classes="p-[5px] gap-[5px] text-black-500  dark:text-white"
                                                grow
                                                onClick={recoverWallet}
                                                title="Restore your wallet from an encrypted backup"
                                            >
                                                <i class="bx bx-upload"> </i>
                                                Recover
                                            </Button>
                                            <Button
                                                variant="text"
                                                classes="p-[5px] gap-[5px] text-black-500  dark:text-white"
                                                grow
                                                onClick={handleCleanWallet}
                                                title="Remove spent tokens and consolidate your wallet state"
                                            >
                                                {#if cleaningWallet}
                                                    <ProgressRing color="white" />
                                                {:else}
                                                    <i class="fa-solid fa-broom"></i>
                                                    Clean
                                                {/if}
                                            </Button>
                                        </div>
                                    </Card>
                                </div>
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
                                            onClick={() => ($displayEcashWarning = false)}
                                            title="Dismiss warning"
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
                                                <Button
                                                    onClick={exploreMints}
                                                    title="Browse and add Cashu mints"
                                                >
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
                                                            aria-label="Remove Mint"
                                                            title="Remove mint"
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
                                                <Button onClick={addRelay} title="Add a relay for wallet backup events">
                                                    Add Relay
                                                </Button>
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
                                                                aria-label="Remove Relay"
                                                                title="Remove relay"
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

<AddRelayModal bind:isOpen={showAddRelayModal} callback={handleAddRelay} />

{#if relayToRemove}
    <RelayRemovalConfirmation
        bind:isOpen={showRelayRemovalConfirmation}
        url={relayToRemove}
        onConfirm={async () => {
            await handleRemoveRelay(relayToRemove!);
            relayToRemove = null;
        }}
    />
{/if}

{#if mintToRemove}
    <RemoveMintModal
        bind:isOpen={showMintRemovalConfirmation}
        mint={mintToRemove}
        onConfirm={async () => {
            await handleRemoveMint(mintToRemove!);
            mintToRemove = null;
        }}
    />
{/if}

{#if tempWallet}
    <ExploreMintsModal
        bind:isOpen={showMintModal}
        cashuWallet={tempWallet}
        callback={handleMintSelection}
    />
{/if}

{#if $wallet}
    <ExploreMintsModal
        bind:isOpen={showExploreMintsModal}
        cashuWallet={$wallet}
        callback={handleMintsUpdate}
    />
{/if}

<RecoverEcashWallet bind:isOpen={showRecoverEcashWallet} />

<BackupEcashWallet bind:isOpen={showBackupEcashWallet} />

<ConfirmationDialog
    bind:isOpen={showCleanWalletConfirmationDialog}
    confirmText="Clean"
    onConfirm={cleanWallet}
    onCancel={() => (showCleanWalletConfirmationDialog = false)}
>
    <strong class="text-primary-400-500">
        If a wallet contains used tokens, they will be removed and you may see a decrease in wallet
        balance. Do you really wish to clean wallet?
    </strong>
</ConfirmationDialog>

<MnemonicSeedGenerationModal
    bind:isOpen={showMnemonicSeedGenerationModal}
    onCompletion={generateBip39Seed(true)}
/>

<MnemonicSeedInputModal
    bind:isOpen={showMnemonicSeedInputModal}
    onConfirm={generateBip39Seed(false)}
    onSkip={tryLoadWallet}
/>
