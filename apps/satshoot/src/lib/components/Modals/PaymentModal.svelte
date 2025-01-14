<script lang="ts">
    import {
        getModalStore,
        getToastStore,
        popup,
        ProgressRadial,
        type PopupSettings,
    } from '@skeletonlabs/skeleton';
    import CloseModal from '../UI/Buttons/CloseModal.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { Pricing, type OfferEvent } from '$lib/events/OfferEvent';
    import { paymentDetail } from '$lib/stores/payment';
    import currentUser from '$lib/stores/user';
    import {
        cashuPaymentInfoMap,
        cashuTokensBackup,
        unsavedProofsBackup,
        wallet,
    } from '$lib/stores/wallet';
    import { goto } from '$app/navigation';
    import ndk from '$lib/stores/ndk';
    import {
        generateZapRequest,
        NDKEvent,
        NDKKind,
        NDKNutzap,
        NDKRelayList,
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
        zapInvoiceFromEvent,
    } from '@nostr-dev-kit/ndk';
    import { broadcastEvent, fetchUserOutboxRelays, getZapConfiguration } from '$lib/utils/helpers';
    import { tick } from 'svelte';
    import { CashuMint } from '@cashu/cashu-ts';
    import { resyncWalletAndBackup } from '$lib/utils/cashu';
    import { insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { wot } from '$lib/stores/wot';

    enum ToastType {
        Success = 'success',
        Warn = 'warning',
        Error = 'error',
    }

    enum UserEnum {
        Satshoot = 'satshoot',
        Freelancer = 'freelancer',
    }

    interface InvoiceDetails {
        paymentRequest: string;
        receiver: string;
        eventId: string;
        zapper?: string;
    }

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    let ticket: TicketEvent;
    let offer: OfferEvent;

    $: if ($paymentDetail) {
        ticket = $paymentDetail.ticket;
        offer = $paymentDetail.offer;
    }

    let freelancerPaid = 0;
    let satshootPaid = 0;
    let freelancerPaymentStore: NDKEventStore<NDKEvent>;
    let satshootPaymentStore: NDKEventStore<NDKEvent>;

    let pricing = '';

    $: if (offer) {
        switch (offer.pricing) {
            case Pricing.Absolute:
                pricing = 'sats';
                break;
            case Pricing.SatsPerMin:
                pricing = 'sats/min';
                break;
        }

        freelancerPaymentStore = $ndk.storeSubscribe(
            [
                { kinds: [NDKKind.Zap], '#e': [offer.id] },
                { kinds: [NDKKind.Nutzap], '#a': [offer.offerAddress] },
            ],
            {
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1500,
                autoStart: true,
            }
        );

        satshootPaymentStore = $ndk.storeSubscribe(
            [
                {
                    kinds: [NDKKind.Zap],
                    '#p': [SatShootPubkey],
                    '#a': [offer.referencedTicketAddress],
                },
                {
                    kinds: [NDKKind.Nutzap],
                    '#p': [SatShootPubkey],
                    '#a': [offer.referencedTicketAddress],
                },
            ],
            {
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1500,
                autoStart: true,
            }
        );
    }

    $: if ($freelancerPaymentStore) {
        freelancerPaid = 0;
        $freelancerPaymentStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice) {
                    const zappee = zapInvoice.zappee;
                    if ($wot.has(zappee)) {
                        freelancerPaid += Math.round(zapInvoice.amount / 1000);
                    }
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap) {
                    if ($wot.has(nutzap.pubkey)) {
                        freelancerPaid += Math.round(nutzap.amount / 1000);
                    }
                }
            }
        });
    }

    $: if ($satshootPaymentStore) {
        satshootPaid = 0;
        $satshootPaymentStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice) {
                    const zappee = zapInvoice.zappee;
                    if ($wot.has(zappee)) {
                        satshootPaid += Math.round(zapInvoice.amount / 1000);
                    }
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap) {
                    if ($wot.has(nutzap.pubkey)) {
                        satshootPaid += Math.round(nutzap.amount / 1000);
                    }
                }
            }
        });
    }

    let paying = false;
    let errorMessage = '';

    let amount = 0;
    let pledgedAmount = 0;
    let satshootShare = 0;
    let freelancerShare = 0;
    let canPayWithEcash = false;
    let ecashTooltipText = '';
    let hasSenderEcashSetup = false;

    $: if (offer) {
        satshootShare = Math.floor((amount * offer.pledgeSplit) / 100);
        freelancerShare = amount - satshootShare;
    }

    // All checks passed, user can pay with ecash
    $: if (canPayWithEcash) {
        ecashTooltipText = '';
        errorMessage = '';
    }

    $: {
        if (offer && $currentUser) {
            hasSenderEcashSetup = $cashuPaymentInfoMap.has($currentUser.pubkey);
            const hasFreelancerEcashSetup = $cashuPaymentInfoMap.has(offer.pubkey);

            canPayWithEcash = true;

            if (!hasSenderEcashSetup) {
                errorMessage = 'Setup Cashu wallet to pay with ecash!';
            } else if (!hasFreelancerEcashSetup) {
                canPayWithEcash = false;
                ecashTooltipText = 'Freelancer does not have ecash wallet';
                errorMessage = 'Freelancer does not have ecash wallet';
            } else if (!$wallet) {
                canPayWithEcash = false;
                ecashTooltipText = 'Wallet is not initialized yet';
                errorMessage = 'Wallet is not initialized yet';
            } else {
                $wallet
                    .balance()
                    .then((balance) => {
                        const totalAmount = satshootShare + pledgedAmount + freelancerShare;
                        if (!balance) {
                            canPayWithEcash = false;
                            ecashTooltipText = `Don't have enough balance in ecash wallet`;
                            errorMessage = `Don't have enough balance in ecash wallet`;
                        } else if (balance[0].amount < totalAmount) {
                            canPayWithEcash = false;
                            ecashTooltipText = `Don't have enough balance in ecash wallet`;
                            errorMessage = `Don't have enough balance in 
                                            ecash wallet(${balance[0].amount} sats)`;
                        }
                    })
                    .catch((err) => {
                        console.error('An error occurred in fetching wallet balance', err);
                        canPayWithEcash = false;
                        ecashTooltipText = `Don't have enough balance in ecash wallet`;
                        errorMessage = `Don't have enough balance in ecash wallet`;
                    });
            }
        }
    }

    async function payWithLN() {
        const paymentData = await initializePayment();
        if (!paymentData) return;

        const { freelancerShareMillisats, satshootSumMillisats } = paymentData;

        try {
            const zapRequestRelays = new Map<UserEnum, string[]>();
            const invoices = new Map<UserEnum, InvoiceDetails>();
            const paid = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, false],
                [UserEnum.Satshoot, false],
            ]);

            if (freelancerShare > 0) {
                await fetchPaymentInfo(
                    UserEnum.Freelancer,
                    offer!.pubkey,
                    freelancerShareMillisats,
                    zapRequestRelays,
                    invoices,
                    'offer'
                );
            }

            if (satshootSumMillisats > 0) {
                await fetchPaymentInfo(
                    UserEnum.Satshoot,
                    SatShootPubkey,
                    satshootSumMillisats,
                    zapRequestRelays,
                    invoices,
                    'ticket'
                );
            }

            const { init, launchPaymentModal, closeModal, onModalClosed } = await import(
                '@getalby/bitcoin-connect'
            );
            init({ appName: 'SatShoot' });

            for (const [key, invoice] of invoices.entries()) {
                if (!invoice) continue;

                launchPaymentModal({
                    invoice: invoice.paymentRequest,
                    onPaid: () => paid.set(key, true),
                });

                const filter = {
                    kinds: [NDKKind.Zap],
                    since: Math.floor(Date.now() / 1000),
                    '#p': [invoice.receiver],
                    authors: invoice.zapper ? [invoice.zapper] : undefined,
                };

                try {
                    const subscription = $ndk.subscribe(
                        filter,
                        { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY },
                        NDKRelaySet.fromRelayUrls(zapRequestRelays.get(key)!, $ndk)
                    );

                    subscription.on('event', async (event) => {
                        if (event.tagValue('bolt11') === invoice.paymentRequest && !paid.get(key)) {
                            paid.set(key, true);
                            closeModal();
                        }
                    });

                    await new Promise<void>((resolve) => {
                        const unsub = onModalClosed(() => {
                            subscription.stop();
                            resolve();
                            unsub();
                        });
                    });
                } catch (error) {
                    console.error('An error occurred in payment process', error);
                    errorMessage = `Could not fetch ${key === UserEnum.Freelancer ? "Freelancer's" : "Satshoot's"} zap receipt: ${error}`;
                }
            }

            handlePaymentStatus(
                paid,
                UserEnum.Freelancer,
                freelancerShareMillisats,
                'Freelancer Paid!',
                'Freelancer Payment might have failed!'
            );
            handlePaymentStatus(
                paid,
                UserEnum.Satshoot,
                satshootSumMillisats,
                'SatShoot Paid!',
                'SatShoot Payment might have failed!'
            );

            paying = false;
        } catch (error) {
            console.error(error);
            handleToast(`Error: An error occurred in payment process: ${error}`, ToastType.Error);
            paying = false;
        }
    }

    async function payWithEcash() {
        const paymentData = await initializePayment();
        if (!paymentData) return;

        const { freelancerShareMillisats, satshootSumMillisats } = paymentData;

        try {
            const paid = new Map<UserEnum, boolean>([
                [UserEnum.Freelancer, false],
                [UserEnum.Satshoot, false],
            ]);

            async function processPayment(
                userEnum: UserEnum,
                pubkey: string,
                amountMillisats: number
            ) {
                if (amountMillisats > 0 && $cashuPaymentInfoMap.has(pubkey)) {
                    const cashuPaymentInfo = $cashuPaymentInfoMap.get(pubkey);
                    if (!cashuPaymentInfo) {
                        errorMessage = `Could not fetch cashu payment info for ${userEnum}!`;
                        return;
                    }

                    if (!$wallet) {
                        errorMessage = 'Wallet is not initialized!';
                        return;
                    }

                    const balance = await $wallet.balance();
                    if (!balance) {
                        errorMessage = `Don't have enough balance`;
                        return;
                    }

                    let balanceInMilliSats = balance[0].amount;
                    if (balance[0].unit === 'sats') {
                        balanceInMilliSats *= 1000;
                    }

                    if (balanceInMilliSats < amountMillisats) {
                        errorMessage = `Don't have enough balance`;
                        return;
                    }

                    const mintPromises = cashuPaymentInfo.mints.map(async (mintUrl) => {
                        const mint = new CashuMint(mintUrl);
                        return mint
                            .getInfo()
                            .then((info) => {
                                if (info.nuts[4].methods.some((method) => method.unit === 'sat')) {
                                    return mintUrl;
                                }
                                return null;
                            })
                            .catch((err) => {
                                console.error(
                                    'An error occurred in getting mint info',
                                    mintUrl,
                                    err
                                );
                                return null;
                            });
                    });

                    const mints = await Promise.all(mintPromises).then((mints) => {
                        return mints.filter((mint) => mint !== null);
                    });

                    if (mints.length === 0) {
                        errorMessage = `Could not find a mint for ${userEnum} that support sats!`;
                        return;
                    }

                    const cashuResult = await $wallet
                        .cashuPay({
                            ...cashuPaymentInfo,
                            mints,
                            target: userEnum === UserEnum.Freelancer ? offer! : ticket,
                            recipientPubkey: pubkey,
                            amount: amountMillisats,
                            unit: 'msat',
                            comment: 'satshoot',
                        })
                        .catch((err) => {
                            const failedPaymentRecipient =
                                userEnum === UserEnum.Freelancer ? 'freelancer' : 'satshoot';

                            console.error(`Failed to pay ${failedPaymentRecipient}`, err);
                            errorMessage = `Failed to pay ${failedPaymentRecipient}:${err?.message || err}`;
                            return null;
                        });

                    console.log('cashuResult :>> ', cashuResult);

                    if (!cashuResult) {
                        return;
                    }

                    const nutzapEvent = new NDKNutzap($ndk);
                    nutzapEvent.mint = cashuResult.mint;
                    nutzapEvent.proofs = cashuResult.proofs;
                    nutzapEvent.unit = 'sat';
                    // NOTE: set target is not properly implemented in NDKNutzap, so manually add reference tag
                    // nutzapEvent.target = userEnum === UserEnum.Freelancer ? offer! : ticket;
                    nutzapEvent.tags.push([
                        'a',
                        userEnum === UserEnum.Freelancer
                            ? offer!.offerAddress
                            : ticket.ticketAddress,
                    ]);
                    nutzapEvent.tags.push([
                        'e',
                        userEnum === UserEnum.Freelancer ? offer!.id : ticket.id,
                    ]);
                    nutzapEvent.recipientPubkey = pubkey;
                    await nutzapEvent.sign();

                    // According to spec NutZap should be published to relays indicated in Nutzap informational event (10009)

                    const explicitRelays: string[] = [];

                    const relayListEvent = await fetchUserOutboxRelays($ndk, pubkey);
                    if (relayListEvent) {
                        const relayList = NDKRelayList.from(relayListEvent);
                        explicitRelays.push(...relayList.readRelayUrls);
                    }
                    explicitRelays.push(...cashuPaymentInfo.relays);

                    const publishedRelaySet = await broadcastEvent(
                        $ndk,
                        nutzapEvent,
                        explicitRelays,
                        false,
                        false,
                        false
                    );

                    console.log('publishedRelaySet :>> ', publishedRelaySet);

                    paid.set(userEnum, true);
                }
            }

            await processPayment(UserEnum.Freelancer, offer!.pubkey, freelancerShareMillisats);

            // its possible that after one payment wallet may contains used tokens
            // so, resync wallet and backup before making other payment
            // this will remove any used tokens in the wallet
            if ($wallet) {
                await resyncWalletAndBackup($wallet!, $cashuTokensBackup, $unsavedProofsBackup);
            }

            await processPayment(UserEnum.Satshoot, SatShootPubkey, satshootSumMillisats);

            handlePaymentStatus(
                paid,
                UserEnum.Freelancer,
                freelancerShareMillisats,
                'Freelancer Paid!',
                'Freelancer Payment might have failed!'
            );
            handlePaymentStatus(
                paid,
                UserEnum.Satshoot,
                satshootSumMillisats,
                'SatShoot Paid!',
                'SatShoot Payment might have failed!'
            );

            paying = false;
        } catch (error: any) {
            console.error(error);
            handleToast(
                `An error occurred in payment process: ${error?.message || error}`,
                ToastType.Error
            );
            paying = false;
        }
    }

    async function initializePayment() {
        if (!ticket || !offer) {
            paying = false;
            handleToast('Error: Could not find ticket and offer!', ToastType.Error);
            return null;
        }

        errorMessage = '';
        paying = true;
        await tick();

        const freelancerShareMillisats = freelancerShare * 1000;
        const satshootSumMillisats = (satshootShare + pledgedAmount) * 1000;

        if (freelancerShareMillisats + satshootSumMillisats === 0) {
            errorMessage = 'Cannot pay 0 sats!';
            paying = false;
            return null;
        }

        return { freelancerShareMillisats, satshootSumMillisats };
    }

    async function fetchPaymentInfo(
        userEnum: UserEnum,
        pubkey: string,
        amountMillisats: number,
        zapRequestRelays: Map<UserEnum, string[]>,
        invoices: Map<UserEnum, InvoiceDetails>,
        key: string
    ) {
        const zapConfig = await getZapConfiguration(pubkey);
        if (zapConfig) {
            const invoice = await generateInvoice(
                key === 'ticket' ? ticket : offer,
                amountMillisats,
                zapConfig,
                pubkey,
                {
                    comment: 'satshoot',
                    tags: [['P', $currentUser!.pubkey]],
                },
                userEnum,
                zapRequestRelays
            );

            if (invoice) {
                invoices.set(userEnum, {
                    paymentRequest: invoice,
                    receiver: pubkey,
                    eventId: key === 'ticket' ? ticket.id : offer!.id,
                    zapper: zapConfig.nostrPubkey,
                });
            } else {
                errorMessage = `Could not zap ${userEnum}: Failed to fetch payment invoice`;
            }
        } else {
            errorMessage = `Could not fetch ${userEnum} zap info!`;
        }
    }

    async function generateInvoice(
        target: any, // todo: fix type
        amount: number,
        zapConfig: any, // todo: fix type
        receiver: string,
        opts: any, // todo: fix type
        user: UserEnum,
        zapRequestRelays: Map<UserEnum, string[]>
    ) {
        // Get NDKZapper object
        const zapper = $ndk.zap(offer!, amount, opts);
        const relays = await zapper.relays(receiver);

        const zapRequest = await generateZapRequest(
            target,
            $ndk,
            zapConfig,
            receiver,
            amount,
            relays,
            opts.comment,
            opts.tags
        ).catch((err) => {
            console.log('Error: An error occurred in generating zap request!', err);
            return null;
        });

        if (!zapRequest) return;

        const relayUrls = zapRequest.tags.find((t) => t[0] === 'relays')?.slice(1) || [];

        zapRequestRelays.set(user, relayUrls);

        const invoice = await zapper.getLnInvoice(zapRequest, amount, zapConfig).catch((err) => {
            console.log('Error: An error occurred in getting LnInvoice!', err);
            return null;
        });

        return invoice;
    }

    // Helper function to handle toast notifications about payment status
    function handlePaymentStatus(
        paid: Map<UserEnum, boolean>,
        userEnum: UserEnum,
        shareMillisats: number,
        successMessage: string,
        failureMessage: string
    ) {
        if (paid.get(userEnum)) {
            handleToast(successMessage, ToastType.Success, false);
        } else if (shareMillisats > 0) {
            handleToast(failureMessage, ToastType.Warn, false);
        }
    }

    function handleToast(message: string, type: ToastType, autohide: boolean = true) {
        toastStore.trigger({
            message,
            timeout: 7000,
            autohide,
            background: `bg-${type}-300-600-token`,
        });
    }

    function setupEcash() {
        goto('/my-cashu-wallet/');
    }

    const popupHoverCashuPaymentAvailableStatus: PopupSettings = {
        event: 'hover',
        target: 'popupHover',
        placement: 'top',
    };

    const popupClasses = 'card w-60 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto';

    const inputClasses =
        'transition ease duration-[0.3s] w-full bg-[rgb(0,0,0,0.05)] border-[2px] border-[rgb(0,0,0,0.1)] ' +
        'rounded-[6px] px-[10px] py-[5px] outline-[0px] outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]';

    const btnClasses =
        'transition-all ease duration-[0.3s] py-[5px] px-[10px] rounded-[4px] grow-[1] border-[1px] border-[rgb(0,0,0,0.1)] ' +
        'bg-[#3b73f6] text-[rgb(255,255,255,0.5)] hover:border-[rgb(0,0,0,0.0)] hover:text-white hover:bg-blue-500 disabled:cursor-not-allowed';
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <div
                        class="w-full bg-white p-[15px] rounded-[8px] shadow-[0_0_8px_0_rgb(0,0,0,0.25)] gap-[5px]"
                    >
                        <div
                            class="flex flex-row justify-between gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
                        >
                            <p class="font-[500] text-[18px]">Pay Freelancer</p>
                            <CloseModal />
                        </div>
                        {#if ticket && offer}
                            <div class="w-full flex flex-col">
                                <!-- popups Share Job Post start -->
                                <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                                    <div
                                        class="w-full flex flex-col gap-[10px] rounded-[4px] border-[1px] border-[rgb(0,0,0,0.1)] p-[10px]"
                                    >
                                        <UserProfile pubkey={offer.pubkey} />
                                        <div
                                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] mt-[5px] border-t-[1px] border-t-[rgb(0,0,0,0.1)]"
                                        >
                                            <div class="grow-[1]">
                                                <p class="font-[500]">
                                                    Offer cost:
                                                    <span class="font-[300]">
                                                        {insertThousandSeparator(offer.amount) +
                                                            ' ' +
                                                            pricing}
                                                    </span>
                                                </p>
                                            </div>
                                            <div class="grow-[1]">
                                                <p class="font-[500]">
                                                    Pledge split:
                                                    <span class="font-[300]">
                                                        {offer.pledgeSplit} %</span
                                                    >
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] mt-[5px] border-t-[1px] border-t-[rgb(0,0,0,0.1)]"
                                        >
                                            <div class="grow-[1]">
                                                <p class="font-[500]">
                                                    Freelancer Paid: <span class="font-[300]"
                                                        >{insertThousandSeparator(freelancerPaid)} sats</span
                                                    >
                                                </p>
                                            </div>
                                            <div class="grow-[1]">
                                                <p class="font-[500]">
                                                    Satshoot Paid: <span class="font-[300]"
                                                        >{insertThousandSeparator(satshootPaid)} sats</span
                                                    >
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px] border-[1px] border-[rgb(0,0,0,0.1)] rounded-[4px] px-[10px] py-[10px]"
                                    >
                                        <p class="">Compensation for:</p>
                                        <p class="">{ticket.title}</p>
                                    </div>
                                    <div
                                        class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px] border-[1px] border-[rgb(0,0,0,0.1)] rounded-[4px] px-[10px] py-[10px]"
                                    >
                                        <div class="w-full flex flex-col gap-[5px]">
                                            <div class="w-full flex flex-col gap-[5px]">
                                                <label class="font-[500]" for="service-payment"
                                                    >Pay for service</label
                                                >
                                                <input
                                                    id="service-payment"
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    max="100_000_000"
                                                    placeholder="000,000"
                                                    bind:value={amount}
                                                    class={inputClasses}
                                                />
                                            </div>
                                            <div class="w-full flex flex-col gap-[5px]">
                                                <label
                                                    class="font-[500]"
                                                    for="plattform-contribution"
                                                    >Contribute to SatShoot</label
                                                >
                                                <input
                                                    id="plattform-contribution"
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    max="100_000_000"
                                                    placeholder="000,000"
                                                    bind:value={pledgedAmount}
                                                    class={inputClasses}
                                                />
                                            </div>
                                        </div>
                                        <div
                                            class="w-full flex flex-row flex-wrap gap-[10px] pt-[10px] mt-[10px] border-t-[1px] border-[rgb(0,0,0,0.1)]"
                                        >
                                            <p class="grow-[1] text-center">
                                                Freelancer gets: {insertThousandSeparator(
                                                    freelancerShare
                                                )} sats
                                            </p>
                                            <p class="grow-[1] text-center">
                                                SatShoot gets: {insertThousandSeparator(
                                                    satshootShare
                                                ) +
                                                    ' + ' +
                                                    insertThousandSeparator(pledgedAmount ?? 0) +
                                                    ' = ' +
                                                    insertThousandSeparator(
                                                        satshootShare + (pledgedAmount ?? 0)
                                                    ) +
                                                    ' sats'}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="w-full flex flex-row flex-wrap gap-[5px]">
                                        <button
                                            class={btnClasses}
                                            type="button"
                                            on:click={payWithLN}
                                            disabled={paying}
                                        >
                                            {#if paying}
                                                <span>
                                                    <ProgressRadial
                                                        value={undefined}
                                                        stroke={60}
                                                        meter="stroke-tertiary-500"
                                                        track="stroke-tertiary-500/30"
                                                        strokeLinecap="round"
                                                        width="w-8"
                                                    />
                                                </span>
                                            {:else}
                                                Make payment (Zaps)
                                            {/if}
                                        </button>
                                        {#if hasSenderEcashSetup}
                                            <button
                                                class={btnClasses}
                                                type="button"
                                                on:click={payWithEcash}
                                                use:popup={popupHoverCashuPaymentAvailableStatus}
                                                disabled={paying || !canPayWithEcash}
                                            >
                                                {#if paying}
                                                    <ProgressRadial
                                                        value={undefined}
                                                        stroke={60}
                                                        meter="stroke-tertiary-500"
                                                        track="stroke-tertiary-500/30"
                                                        strokeLinecap="round"
                                                        width="w-8"
                                                    />
                                                {/if}
                                                Make payment (Cashu)
                                            </button>
                                        {:else}
                                            <button
                                                class={btnClasses}
                                                type="button"
                                                on:click={setupEcash}
                                                use:popup={popupHoverCashuPaymentAvailableStatus}
                                            >
                                                {#if paying}
                                                    <span>
                                                        <ProgressRadial
                                                            value={undefined}
                                                            stroke={60}
                                                            meter="stroke-tertiary-500"
                                                            track="stroke-tertiary-500/30"
                                                            strokeLinecap="round"
                                                            width="w-8"
                                                        />
                                                    </span>
                                                {/if}

                                                Setup Cashu Wallet
                                            </button>
                                        {/if}
                                    </div>
                                    <div data-popup="popupHover">
                                        <div class={popupClasses}>
                                            <p>{ecashTooltipText}</p>
                                        </div>
                                    </div>
                                </div>
                                <!-- popups Share Job Post end -->
                            </div>
                        {:else}
                            <h2 class="h2 font-bold text-center text-error-300-600-token">
                                Error: Ticket & Offer is missing!
                            </h2>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
