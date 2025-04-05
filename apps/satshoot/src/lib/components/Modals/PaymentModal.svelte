<script lang="ts">
    import {
        getModalStore,
        getToastStore,
        popup,
        ProgressRadial,
        type PopupSettings,
    } from '@skeletonlabs/skeleton';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { Pricing, type OfferEvent } from '$lib/events/OfferEvent';
    import {
        createPaymentFilters,
        createPaymentStore,
        paymentDetail,
        type PaymentStore,
    } from '$lib/stores/payment';
    import currentUser from '$lib/stores/user';
    import {
        cashuPaymentInfoMap,
        wallet,
    } from '$lib/wallet/wallet';
    import { goto } from '$app/navigation';
    import ndk from '$lib/stores/ndk';
    import {
        generateZapRequest,
        NDKEvent,
        NDKKind,
        NDKNutzap,
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
        NDKZapper,
        type NDKLnUrlData,
        type NDKZapperOptions,
    } from '@nostr-dev-kit/ndk';
    import { broadcastEvent, getZapConfiguration } from '$lib/utils/helpers';
    import { onDestroy, tick } from 'svelte';
    import { CashuMint, type Proof } from '@cashu/cashu-ts';
    import { insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Popup from '../UI/Popup.svelte';
    import Card from '../UI/Card.svelte';

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

    type NutZapErrorData = {
        mint: string,
        proofs: Proof[]
    }

    class NutZapError extends Error {
        constructor(
            message: string,
            public readonly data: NutZapErrorData,
        ) {
            super(message);
            this.name = this.constructor.name;
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, this.constructor);
            }
        }
    }

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    // TODO: As soon as Modals can take Props this needs to stop
    let ticket: TicketEvent | undefined = $derived($paymentDetail?.ticket);
    let offer: OfferEvent | undefined = $derived($paymentDetail?.offer);

    let paying = $state(false);
    let amount = $state(0);
    const safety = 3; // 3 sats safety added when estimating balances for payments
    let pledgedAmount = $state(0);
    let satshootShare = $state(0);
    let freelancerShare = $state(0);
    let canPayWithEcash = $state(false);
    let ecashTooltipText = $state('');
    let hasSenderEcashSetup = $derived(!!$wallet);

    let freelancerPaid = $state(0);
    let satshootPaid = $state(0);
    let freelancerPaymentStore: PaymentStore;
    let satshootPaymentStore: PaymentStore;

    let pricing = $state('');


    $effect(() => {
        if (offer && $currentUser) {
            const hasFreelancerEcashSetup = $cashuPaymentInfoMap.has(offer.pubkey);

            canPayWithEcash = true;

            if (!hasSenderEcashSetup) {
                canPayWithEcash = false;
                ecashTooltipText = 'Setup Nostr Wallet to pay with ecash!';
            } else if (!hasFreelancerEcashSetup) {
                canPayWithEcash = false;
                ecashTooltipText = 'Freelancer does not have ecash wallet';
            } else if (!$wallet) {
                canPayWithEcash = false;
                ecashTooltipText = 'Wallet is not initialized yet';
            } else {
                let mintExistsWithSufficientBalance = $wallet!.getMintsWithBalance(
                    satshootShare + pledgedAmount + freelancerShare + safety
                ).length > 0;
                if (!mintExistsWithSufficientBalance) {
                    canPayWithEcash = false;
                    ecashTooltipText = 'No Mint in Nostr Wallet has enough balance for this amount!';
                }
            }

            // If all checks passed, user can pay with ecash
            if (canPayWithEcash) {
                ecashTooltipText = '';
            }

            switch (offer.pricing) {
                case Pricing.Absolute:
                    pricing = 'sats';
                    break;
                case Pricing.SatsPerMin:
                    pricing = 'sats/min';
                    break;
            }

            const freelancerFilters = createPaymentFilters(offer, 'freelancer');
            const satshootFilters = createPaymentFilters(offer, 'satshoot');

            freelancerPaymentStore = createPaymentStore(freelancerFilters);
            satshootPaymentStore = createPaymentStore(satshootFilters);

            freelancerPaymentStore.totalPaid.subscribe((value) => {
                freelancerPaid = value;
            });

            satshootPaymentStore.totalPaid.subscribe((value) => {
                satshootPaid = value;
            });

            satshootShare = Math.floor((amount * offer.pledgeSplit) / 100);
            freelancerShare = amount - satshootShare;
        }
    });

    onDestroy(() => {
        if (freelancerPaymentStore) freelancerPaymentStore.paymentStore.empty();
        if (satshootPaymentStore) satshootPaymentStore.paymentStore.empty();
    });

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
                    offer!
                ).catch((err) => {
                    handleToast(
                        `An error occurred in fetching Freelancer's payment info: ${err.message || err}`,
                        ToastType.Error
                    );
                });
            }

            if (satshootSumMillisats > 0) {
                await fetchPaymentInfo(
                    UserEnum.Satshoot,
                    SatShootPubkey,
                    satshootSumMillisats,
                    zapRequestRelays,
                    invoices,
                    ticket!
                ).catch((err) => {
                    handleToast(
                        `An error occurred in fetching satshoot's payment info: ${err.message || err}`,
                        ToastType.Error
                    );
                });
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
                    handleToast(
                        `Error: Could not fetch ${key === UserEnum.Freelancer ? "Freelancer's" : "SatShoot's"} zap receipt: ${error}`,
                        ToastType.Error
                    );
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


            const freelancerPaymentPromise = processCashuPayment(
                UserEnum.Freelancer,
                offer!.pubkey,
                freelancerShareMillisats
            )

            const satshootPaymentPromise = processCashuPayment(
                UserEnum.Satshoot,
                SatShootPubkey,
                satshootSumMillisats
            )

            const results = await Promise.allSettled(
                [freelancerPaymentPromise, satshootPaymentPromise]
            );

            results.forEach((result, index) => {
                // One of the payments failed
                if (result.status !== 'fulfilled') {
                    if (index === 0) {
                        handlePaymentError(result.reason, 'Freelancer')
                    } else {
                        handlePaymentError(result.reason, 'SatShoot')
                    }
                // One of the payments succeeded
                } else {
                    if (index === 0) {
                        paid.set(UserEnum.Freelancer, true)
                    } else {
                        paid.set(UserEnum.Satshoot, true)
                    }
                }
            });

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
                `Error: ${error?.message || error}`,
                ToastType.Error
            );
            paying = false;
        }
    }

    const processCashuPayment = async (
        userEnum: UserEnum,
        pubkey: string,
        amountMillisats: number
    ) => {
        if (amount === 0) return;

        const cashuPaymentInfo = $cashuPaymentInfoMap.get(pubkey);
        if (!cashuPaymentInfo || !cashuPaymentInfo.mints) {
            throw new Error(
                `Could not fetch cashu payment info for ${userEnum}!`
            );
        }

        if (!$wallet) {
            throw new Error('Wallet is not initialized!');
        }

        const mintsWithBalance = $wallet.getMintsWithBalance(
            Math.floor(amountMillisats/1000) + safety
        );

        // Double-check balance
        if (mintsWithBalance.length === 0) {
            throw new Error(`No Mint with enough balance to complete the payment!`);
        }

        // TODO: Could offer payment with multiple Mints with enough balance here
        const mintPromises = cashuPaymentInfo.mints.map(async (mintUrl) => {
            const mint = new CashuMint(mintUrl);
            return mint
                .getInfo()
                .then((info) => {
                    if (info.nuts[4].methods.some(
                        (method) => method.unit === 'sat')
                    ) {
                        return mintUrl;
                    }
                    return null;
                })
                .catch((err) => {
                    console.error(
                        'Error while retrieving candidate Mint info',
                        mintUrl,
                        err
                    );
                    return null;
                });
        });

        const mintInfoResults = await Promise.allSettled(mintPromises).then((mints) => {
            return mints.filter((mint) => mint !== null);
        });

        const mints: string[] = [];
        mintInfoResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value){
                mints.push(result.value);
            }
        });

        if (mints.length === 0) {
            throw new Error(
                `Could not find a mint for ${userEnum} that support sats!`
            );
        }

        // Always use freelancers Mint preference or fail
        cashuPaymentInfo.allowIntramintFallback = false;
        // Get Proofs tied to p2pk of freelancer
        const cashuResult = await $wallet
            .cashuPay({
                ...cashuPaymentInfo,
                mints,
                target: userEnum === UserEnum.Freelancer ? offer! : ticket!,
                recipientPubkey: pubkey,
                amount: amountMillisats,
                unit: 'msat',
                comment: 'satshoot',
            })
            .catch((err) => {
                throw new Error(`Failed to pay: ${err?.message || err}`);
            });

        if (!cashuResult) {
            throw new Error(
                'Unknown error occurred while minting Proofs for NutZap!'
            );
        }
        const nutzapEvent = new NDKNutzap($ndk);
        nutzapEvent.mint = cashuResult.mint;
        nutzapEvent.proofs = cashuResult.proofs;
        nutzapEvent.unit = 'sat';

        // NOTE: set target is not properly implemented in NDKNutzap,
        // so manually add reference tag
        // nutzapEvent.target = userEnum === UserEnum.Freelancer
        //                  ? offer! : ticket;

        nutzapEvent.tags.push([
            'a',
            userEnum === UserEnum.Freelancer
                ? offer!.offerAddress
                : ticket!.ticketAddress,
        ]);

        nutzapEvent.tags.push([
            'e',
            userEnum === UserEnum.Freelancer ? offer!.id : ticket!.id,
        ]);

        nutzapEvent.recipientPubkey = pubkey;

        const explicitRelays = [...cashuPaymentInfo.relays ?? []];

        await trySignAndPublishNutZap(nutzapEvent, explicitRelays);
    }

    const handlePaymentError = (err: Error, payee: string) => {
        // Save already minted p2pk NutZap proofs, when Nostr event creation fails
        if (err instanceof NutZapError) {
            toastStore.trigger({
                message: err.message,
                background: 'bg-error-300-600-token',
                autohide: false,
                action: {
                    label: 'Copy Proofs',
                    response: () => {
                        navigator.clipboard.writeText(JSON.stringify(err.data));
                        handleToast(
                            'Copied Proofs with Mint info to clipboard!',
                            ToastType.Warn,
                            false
                        );
                    },
                },
            });

        } else {
            handleToast(
                `An error occurred in processing payment for ${payee}:` +
                    `${err.message || err}`,
                ToastType.Error
            );
        }
    }

    const trySignAndPublishNutZap = async(
        nutzapEvent: NDKNutzap,
        explicitRelays: string[]
    ) => {
        try {
            await nutzapEvent.sign();

            // According to spec NutZap should be published to relays 
            // indicated in Cashu Payment info event (10019), with a fallback to
            // inbox relays. We broadcast everywhere possible, including these

            const publishedRelaySet = await broadcastEvent(
                $ndk,
                nutzapEvent,
                {
                    explicitRelays,
                    includePoolRelays: true,
                    includeOutboxPoolRelays: true,
                    includeBlastUrl: true
                }
            );

            console.log('publishedRelaySet :>> ', publishedRelaySet);
        } catch (err) {
            handleToast(
                `An error occurred while trying to create NutZap` +
                    ` event from Proofs: ${err}`,
                ToastType.Error
            );
            const rawNutzap: {mint: string, proofs: Proof[]} = {
                mint: nutzapEvent.mint,
                proofs: nutzapEvent.proofs
            }
            const message = `Copy the minted NutZap Proofs and save ` +
                `somewhere safe then try to send to recipient manually`;

            throw new NutZapError(message, rawNutzap)
        }
    }

    async function initializePayment() {
        if (!ticket || !offer) {
            paying = false;
            handleToast('Error: Could not find Job or Offer!', ToastType.Error);
            return null;
        }

        paying = true;
        await tick();

        const freelancerShareMillisats = freelancerShare * 1000;
        const satshootSumMillisats = (satshootShare + pledgedAmount) * 1000;

        if (freelancerShareMillisats + satshootSumMillisats === 0) {
            paying = false;
            handleToast('Error: Cannot pay 0 sats!', ToastType.Error);
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
        event: TicketEvent | OfferEvent
    ) {
        const zapConfig = await getZapConfiguration(pubkey);
        if (zapConfig) {
            // Pledges zap the Job rather than the Offer
            const invoice = await generateInvoice(
                event,
                amountMillisats,
                zapConfig,
                pubkey,
                {
                    nutzapAsFallback: false,
                    comment: 'satshoot',
                    tags: [['P', $currentUser!.pubkey]],
                },
                userEnum,
                zapRequestRelays
            );

            invoices.set(userEnum, {
                paymentRequest: invoice,
                receiver: pubkey,
                eventId: event.id,
                zapper: zapConfig.nostrPubkey,
            });
        } else {
            throw new Error(`Could not fetch ${userEnum}'s zap config!`);
        }
    }

    async function generateInvoice(
        target: NDKEvent,
        amount: number,
        zapConfig: NDKLnUrlData,
        receiver: string,
        opts: NDKZapperOptions,
        user: UserEnum,
        zapRequestRelays: Map<UserEnum, string[]>
    ) {
        // Get NDKZapper object it is only used for figuring out relays for 
        // LN zapping (for now). LN payments are NOT handled by NDK we just use it 
        // to fetch invoices and zap receipts
        const zapper = new NDKZapper(target, amount, 'msat', opts)
        // const zapper = $ndk.zap(offer!, amount, opts);
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

        if (!zapRequest) throw new Error('Failed to generate zap request');

        const relayUrls = zapRequest.tags.find((t) => t[0] === 'relays')?.slice(1) || [];

        zapRequestRelays.set(user, relayUrls);

        const invoice = await zapper.getLnInvoice(zapRequest, amount, zapConfig).catch((err) => {
            console.log('Error: An error occurred in getting LnInvoice!', err);
            return null;
        });

        if (!invoice) throw new Error('Failed to get LNInvoice');

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

    const cashuTooltip: PopupSettings = {
        event: 'click',
        target: 'cashuTooltip',
        placement: 'top',
    };
</script>

{#if $modalStore[0]}
    <Popup title="Pay Freelancer">
        {#if ticket && offer}
            <div class="w-full flex flex-col">
                <!-- popups Share Job Post start -->
                <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                    <div
                        class="w-full flex flex-col gap-[10px] rounded-[4px] border-[1px] border-black-100 dark:border-white-100 p-[10px]"
                    >
                        <UserProfile pubkey={offer.pubkey} />
                        <div
                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] mt-[5px] border-t-[1px] border-t-black-100"
                        >
                            <div class="grow-[1]">
                                <p class="font-[500]">
                                    Offer cost:
                                    <span class="font-[300]">
                                        {insertThousandSeparator(offer.amount) + ' ' + pricing}
                                    </span>
                                </p>
                            </div>
                            <div class="grow-[1]">
                                <p class="font-[500]">
                                    Pledge split:
                                    <span class="font-[300]"> {offer.pledgeSplit} %</span>
                                </p>
                            </div>
                        </div>
                        <div
                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] mt-[5px] border-t-[1px] border-t-black-100"
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
                                    SatShoot Paid: <span class="font-[300]"
                                        >{insertThousandSeparator(satshootPaid)} sats</span
                                    >
                                </p>
                            </div>
                        </div>
                    </div>
                    <div
                        class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px] border-[1px] border-black-100 dark:border-white-100 rounded-[4px] px-[10px] py-[10px]"
                    >
                        <p class="">Compensation for:</p>
                        <p class="">{ticket.title}</p>
                    </div>
                    <div
                        class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px] border-[1px] border-black-100 dark:border-white-100 rounded-[4px] px-[10px] py-[10px]"
                    >
                        <div class="w-full flex flex-col gap-[5px]">
                            <div class="w-full flex flex-col gap-[5px]">
                                <label class="font-[500]" for="service-payment"
                                    >Pay for service</label
                                >
                                <Input
                                    id="service-payment"
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="000,000"
                                    bind:value={amount}
                                    fullWidth
                                />
                            </div>
                            <div class="w-full flex flex-col gap-[5px]">
                                <label class="font-[500]" for="plattform-contribution"
                                    >Contribute to SatShoot</label
                                >
                                <Input
                                    id="plattform-contribution"
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="000,000"
                                    bind:value={pledgedAmount}
                                    fullWidth
                                />
                            </div>
                        </div>
                        <div
                            class="w-full flex flex-row flex-wrap gap-[10px] pt-[10px] mt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                        >
                            <p class="grow-[1] text-center">
                                Freelancer gets: {insertThousandSeparator(freelancerShare)} sats
                            </p>
                            <p class="grow-[1] text-center">
                                SatShoot gets: {insertThousandSeparator(satshootShare) +
                                    ' + ' +
                                    insertThousandSeparator(pledgedAmount ?? 0) +
                                    ' = ' +
                                    insertThousandSeparator(satshootShare + (pledgedAmount ?? 0)) +
                                    ' sats'}
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-row justify-center">
                        <div class="flex flex-col gap-[5px]">
                            <div class="flex flex-row">
                                <Button
                                    grow
                                    classes="w-[200px] max-w-[200px]"
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
                                        <img
                                            class="h-[20px] w-auto"
                                            src="/img/lightning.png"
                                            alt="Lightning icon"
                                        />
                                        <span> Pay with LN</span>
                                    {/if}
                                </Button>
                            </div>
                            <div class="flex flex-row items-center gap-[2px]">
                                {#if hasSenderEcashSetup}
                                    <Button
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        on:click={payWithEcash}
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
                                        {:else}
                                            <img
                                                class="h-[20px] w-auto"
                                                src="/img/cashu.png"
                                                alt="Cashu icon"
                                            />
                                            <span>Pay with Cashu</span>
                                        {/if}
                                    </Button>
                                {:else}
                                    <Button
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        on:click={setupEcash}
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
                                        <span> Setup Nostr Wallet </span>
                                    </Button>
                                {/if}

                                {#if ecashTooltipText}
                                    <i
                                        class="bx bx-question-mark bg-[red] text-white p-[3px] rounded-[50%]"
                                        use:popup={cashuTooltip}
                                    >
                                    </i>
                                    <div data-popup="cashuTooltip">
                                        <Card>
                                            <p>{ecashTooltipText}</p>
                                        </Card>
                                    </div>
                                {/if}
                            </div>
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
    </Popup>
{/if}
