<script lang="ts">
    import { tick } from 'svelte';

    import {
        generateZapRequest,
        getRelayListForUser,
        NDKKind,
        NDKNutzap,
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
    } from '@nostr-dev-kit/ndk';
    import {
        getToastStore,
        popup,
        ProgressRadial,
        type PopupSettings,
    } from '@skeletonlabs/skeleton';

    import OfferCard from '$lib/components/Cards/OfferCard.svelte';

    import type { OfferEvent } from '$lib/events/OfferEvent';
    import type { TicketEvent } from '$lib/events/TicketEvent';

    import ndk from '$lib/stores/ndk';
    import { paymentDetail } from '$lib/stores/payment';
    import currentUser from '$lib/stores/user';
    import { cashuPaymentInfoMap, wallet } from '$lib/stores/wallet';

    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { getZapConfiguration } from '$lib/utils/helpers';
    import { insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';

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

    let redirectPath: string | null = null;

    $: {
        redirectPath = $page.url.searchParams.get('redirectPath');
    }

    let ticket: TicketEvent;
    let offer: OfferEvent;

    $: if ($paymentDetail) {
        ticket = $paymentDetail.ticket;
        offer = $paymentDetail.offer;
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
                        console.log('balance :>> ', balance);
                        console.log('totalAmount :>> ', totalAmount);
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

            if (paid.get(UserEnum.Freelancer) && paid.get(UserEnum.Satshoot) && redirectPath) {
                goto(redirectPath);
            } else {
                paying = false;
            }
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

                    const cashuResult = await $wallet
                        .cashuPay({
                            target: userEnum === UserEnum.Freelancer ? offer! : ticket,
                            recipientPubkey: pubkey,
                            amount: amountMillisats,
                            unit: 'msat',
                            comment: 'satshoot',
                            ...cashuPaymentInfo,
                        })
                        .catch((err) => {
                            const failedPaymentRecipient =
                                userEnum === UserEnum.Freelancer ? 'freelancer' : 'satshoot';

                            errorMessage = `Failed to pay ${failedPaymentRecipient}:${err}`;
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

                    const receiversRelays = await getRelayListForUser(pubkey, $ndk);

                    const publishedRelaySet = await nutzapEvent.publish(
                        NDKRelaySet.fromRelayUrls(receiversRelays.readRelayUrls, $ndk)
                    );

                    console.log('publishedRelaySet :>> ', publishedRelaySet);

                    paid.set(userEnum, true);
                }
            }

            await processPayment(UserEnum.Freelancer, offer!.pubkey, freelancerShareMillisats);
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

            if (paid.get(UserEnum.Freelancer) && paid.get(UserEnum.Satshoot) && redirectPath) {
                goto(redirectPath);
            } else {
                paying = false;
            }
        } catch (error) {
            console.error(error);
            handleToast(
                'Error: An error occurred in payment process, check console for more details!',
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
        const currentPath = $page.url.pathname;
        const walletUrl = new URL('my-cashu-wallet', window.location.origin);
        walletUrl.searchParams.set('redirectPath', currentPath);

        goto(walletUrl);
    }

    // For tooltip
    const popupPledge: PopupSettings = {
        event: 'click',
        target: 'popupPledge',
        placement: 'bottom',
    };

    const popupHoverCashuPaymentAvailableStatus: PopupSettings = {
        event: 'hover',
        target: 'popupHover',
        placement: 'top',
    };

    const popupClasses = 'card w-60 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto';
    const width = 'max-w-[95vw] sm:max-w-[70vw] lg:max-w-[60vw]';
</script>

{#if ticket && offer}
    <div class="flex justify-center">
        <div class="card bg-surface-200-700-token {width} flex flex-col flex-grow gap-y-2 py-2">
            <h4 class="h4 text-lg sm:text-2xl flex justify-center">Make Payment</h4>
            <!-- Offer -->
            <OfferCard
                {offer}
                showReputation={false}
                showDetails={false}
                showTicket={false}
                showOfferReview={false}
                showDescription={false}
            />

            <!-- Payment -->
            <div class="flex justify-center">
                <label class="max-w-60 flex flex-col items-center">
                    <span class="font-bold">Pay for the Service</span>
                    <div class="input-group input-group-divider grid-cols-[auto_1fr]">
                        <div class="input-group-shim">
                            <i class="fa-brands fa-bitcoin text-3xl" />
                        </div>
                        <input
                            class="text-lg max-w-md"
                            type="number"
                            min="0"
                            max="100_000_000"
                            placeholder="Amount"
                            bind:value={amount}
                        />
                    </div>
                </label>
            </div>

            <!-- Pledge support for development -->

            <div class="flex flex-col items-center">
                <div>
                    <span>Support SatShoot</span>
                    <i
                        class="text-primary-300-600-token fa-solid fa-circle-question text-xl
                                [&>*]:pointer-events-none"
                        use:popup={popupPledge}
                    />

                    <div data-popup="popupPledge">
                        <div class={popupClasses}>
                            <p>Support the development of SatShoot.</p>
                            <p>Your support will be visible as part of your Reputation</p>
                            <div class="arrow bg-primary-300-600-token" />
                        </div>
                    </div>
                </div>
                <label class="max-w-60">
                    <div class="input-group input-group-divider grid-cols-[auto_1fr]">
                        <div class="input-group-shim">
                            <i class="fa-brands fa-bitcoin text-3xl" />
                        </div>
                        <input
                            class="text-lg max-w-md"
                            type="number"
                            min="0"
                            max="100_000_000"
                            placeholder="Amount"
                            bind:value={pledgedAmount}
                        />
                    </div>
                </label>
            </div>

            <div class="flex flex-col items-center">
                <div class="underline">Freelancer gets:</div>
                <div class="font-bold">
                    {insertThousandSeparator(freelancerShare) + 'sats'}
                </div>
                <div class="underline">SatShoot gets:</div>
                <div class="font-bold">
                    {insertThousandSeparator(satshootShare) +
                        ' + ' +
                        insertThousandSeparator(pledgedAmount ?? 0) +
                        ' = ' +
                        insertThousandSeparator(satshootShare + (pledgedAmount ?? 0)) +
                        'sats'}
                </div>
            </div>

            <div class="flex flex-col items-center">
                <button
                    type="button"
                    on:click={payWithLN}
                    class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                    disabled={paying}
                >
                    {#if paying}
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
                    {:else}
                        <div class="flex flex-col items-center gap-y-1">
                            <div class="font-bold">Pay LN</div>
                        </div>
                    {/if}
                    <div class="font-bold">(Public Zap)</div>
                </button>
            </div>
            <div class="flex flex-col items-center">
                {#if hasSenderEcashSetup}
                    <button
                        on:click={payWithEcash}
                        use:popup={popupHoverCashuPaymentAvailableStatus}
                        type="button"
                        class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                        disabled={paying || !canPayWithEcash}
                    >
                        {#if paying}
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
                        <div class="flex flex-col items-center gap-y-1">
                            <div class="font-bold">Pay ecash (Public Zap)</div>
                        </div>
                    </button>
                {:else}
                    <button
                        on:click={setupEcash}
                        use:popup={popupHoverCashuPaymentAvailableStatus}
                        type="button"
                        class="btn btn-sm sm:btn-md min-w-40 bg-tertiary-300-600-token"
                    >
                        {#if paying}
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
                        <div class="flex flex-col items-center gap-y-1">
                            <div class="font-bold">Setup Cashu Wallet</div>
                        </div>
                    </button>
                {/if}

                <div data-popup="popupHover">
                    <div class={popupClasses}>
                        <p>{ecashTooltipText}</p>
                    </div>
                </div>
            </div>

            <div class="text-error-500 text-center">{errorMessage}</div>
        </div>
    </div>
{:else}
    <h2 class="h2 font-bold text-center text-error-300-600-token">
        Error: Ticket & Offer is missing!
    </h2>
{/if}
