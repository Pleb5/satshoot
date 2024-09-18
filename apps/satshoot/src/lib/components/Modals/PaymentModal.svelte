<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    // import type { NDKZapMethod } from "@nostr-dev-kit/ndk";
    import {
        generateZapRequest,
        NDKKind,
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
        type NDKFilter,
    } from '@nostr-dev-kit/ndk';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { Invoice } from '@getalby/lightning-tools';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { type SvelteComponent, tick } from 'svelte';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import OfferCard from '../Cards/OfferCard.svelte';
    import { SatShootPubkey } from '$lib/utils/misc';

    import { insertThousandSeparator } from '$lib/utils/misc';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    /** Exposes parent props to this component. */
    export let parent: SvelteComponent;
    export let ticket: TicketEvent;
    export let offer: OfferEvent | null = null;

    enum ToastType {
        Success = 'success',
        Warn = 'warning',
        Error = 'error',
    }

    enum UserEnum {
        Satshoot = 'satshoot',
        Freelancer = 'freelancer',
    }

    let amount = 0;
    let pledgedAmount = 0;
    let satshootShare = 0;
    let freelancerShare = 0;

    $: if (offer) {
        satshootShare = Math.floor((amount * offer.pledgeSplit) / 100);
        freelancerShare = amount - satshootShare;
    }

    let paying = false;

    const popupClasses = 'card w-60 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto';
    let errorMessage = '';

    // For tooltip
    const popupPledge: PopupSettings = {
        event: 'click',
        target: 'popupPledge',
        placement: 'bottom',
    };

    async function pay() {
        if (ticket && offer) {
            try {
                paying = true;
                await tick();

                let freelancerShareMillisats = freelancerShare * 1000;
                let satshootSumMillisats = (satshootShare + pledgedAmount) * 1000;

                if (freelancerShareMillisats + satshootSumMillisats === 0) {
                    errorMessage = 'Cannot pay 0 sats!';
                    paying = false;
                    return;
                }

                const zapRequestRelays = new Map<UserEnum, string[]>();
                const invoices: Map<
                    UserEnum,
                    {
                        paymentRequest: string;
                        receiver: string;
                        eventId: string;
                        zapper?: string;
                    }
                > = new Map();
                const paid: Map<UserEnum, boolean> = new Map();
                paid.set(UserEnum.Freelancer, false);
                paid.set(UserEnum.Satshoot, false);

                const freelancerUser = $ndk.getUser({ pubkey: offer.pubkey });

                if (freelancerShare > 0) {
                    const zapConfig = await freelancerUser
                        .getZapConfiguration()
                        .catch((err) => {
                            console.log(
                                'Error: An error occurred in getting getZapConfiguration for Freelancer',
                                err
                            );
                            return null;
                        });

                    if (zapConfig) {
                        const invoice = await generateInvoice(
                            offer,
                            freelancerShareMillisats,
                            zapConfig,
                            offer.pubkey,
                            {
                                tags: [['satshoot']],
                            },
                            UserEnum.Freelancer,
                            zapRequestRelays
                        );

                        if (invoice) {
                            invoices.set(UserEnum.Freelancer, {
                                paymentRequest: invoice,
                                receiver: offer.pubkey,
                                eventId: offer.id,
                                zapper: zapConfig.nostrPubkey,
                            });
                        } else {
                            errorMessage =
                                'Could not zap Freelancer: Failed to fetch payment invoice';
                        }
                    } else {
                        errorMessage = 'Could not fetch Freelancer zap info!';
                    }
                }

                const satShootUser = $ndk.getUser({ pubkey: SatShootPubkey });

                if (satshootSumMillisats > 0) {
                    const zapConfig = await satShootUser.getZapConfiguration().catch((err) => {
                        console.log(
                            'Error: An error occurred in getting getZapConfiguration for satshoot',
                            err
                        );
                        return null;
                    });

                    if (zapConfig) {
                        const invoice = await generateInvoice(
                            ticket,
                            satshootSumMillisats,
                            zapConfig,
                            SatShootPubkey,
                            {
                                comment: 'satshoot',
                                tags: [['e', ticket.id]],
                            },
                            UserEnum.Satshoot,
                            zapRequestRelays
                        );

                        if (invoice) {
                            invoices.set(UserEnum.Satshoot, {
                                paymentRequest: invoice,
                                receiver: SatShootPubkey,
                                eventId: ticket.id,
                                zapper: zapConfig.nostrPubkey,
                            });
                        } else {
                            errorMessage =
                                'Could not zap satshoot: Failed to fetch payment invoice';
                        }
                    } else {
                        errorMessage = 'Could not fetch Freelancer zap info!';
                    }
                }

                const { init, launchPaymentModal, closeModal, onModalClosed } = await import(
                    '@getalby/bitcoin-connect'
                );

                // Init getalby bitcoin-connect
                init({ appName: 'SatShoot' });

                for (const key of invoices.keys()) {
                    const invoice = invoices.get(key);

                    if (!invoice) continue;

                    launchPaymentModal({
                        invoice: invoice.paymentRequest,
                        // NOTE: only fired if paid with WebLN
                        onPaid: ({ preimage }) => {
                            const paidInvoice = new Invoice({
                                pr: invoice.paymentRequest,
                            });
                            paidInvoice
                                .validatePreimage(preimage)
                                .then((isValid) => {
                                    paid.set(key, isValid);
                                })
                                .catch(() => {
                                    paid.set(key, false);
                                });
                        },
                    });

                    // Fetch zap receipts if possible
                    const filter: NDKFilter = {
                        kinds: [NDKKind.Zap],
                        since: Math.floor(Date.now() / 1000),
                        '#p': [invoice.receiver],
                    };

                    if (invoice.zapper) {
                        filter['authors'] = [invoice.zapper];
                    }

                    try {
                        const subscription = $ndk.subscribe(
                            filter,
                            {
                                cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
                            },
                            NDKRelaySet.fromRelayUrls(zapRequestRelays.get(key), $ndk)
                        );

                        // Polling timeout
                        const timeout = setTimeout(
                            () => {
                                errorMessage = `Timeout occurred while waiting for zap receipt of ${key}`;
                                closeModal();
                            },
                            1 * 30 * 1000 // 1 minute
                        );

                        subscription.on('event', async (event: NDKEvent) => {
                            const preimage = event.tagValue('preimage');
                            if (preimage) {
                                const paidInvoice = new Invoice({
                                    pr: invoice.paymentRequest,
                                });
                                const isValid = await paidInvoice.validatePreimage(preimage);
                                if (isValid && !paid.get(key)) {
                                    paid.set(key, true);
                                    closeModal();
                                }
                            }
                        });

                        await new Promise<void>((resolve) => {
                            const unsub = onModalClosed(() => {
                                console.log('onModalClosed');
                                subscription.stop();
                                clearTimeout(timeout);
                                resolve();
                                unsub();
                            });
                        });
                    } catch (error) {
                        console.log('An error occurred in payment process', error);
                        errorMessage = "Could not fetch Freelancer's zap receipt: " + error;
                    }
                }

                if (paid.get(UserEnum.Freelancer)) {
                    handleToast('Freelancer Paid!', ToastType.Success, false);
                } else if (freelancerShareMillisats > 0) {
                    handleToast('Freelancer Payment might have failed!', ToastType.Warn, false);
                }
                if (paid.get(UserEnum.Satshoot)) {
                    handleToast('SatShoot Paid!', ToastType.Success, false);
                } else if (satshootSumMillisats > 0) {
                    handleToast('SatShoot Payment might have failed!', ToastType.Warn, false);
                }
                if (modalStore) {
                    modalStore.close();
                }
            } catch (error) {
                console.log(error);
                handleToast(
                    'Error" An error occurred in payment process, check console for more details!',
                    ToastType.Error
                );
                paying = false;
            }
        } else {
            paying = false;
            handleToast('Error: Could could not find ticket and offer!', ToastType.Error);
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
            relays
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

    function handleToast(message: string, type: ToastType, autohide: boolean = true) {
        toastStore.trigger({
            message,
            timeout: 7000,
            autohide,
            background: `bg-${type}-300-600-token`,
        });
    }
</script>

{#if $modalStore[0]}
    {#if ticket && offer}
        <div class="card p-4 flex flex-col gap-y-4 items-center">
            <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Make Payment</h4>
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
            <label class="max-w-60">
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
            <!-- Pledge support for development -->
            <div>
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
            <div class="flex flex-col">
                <div class="underline">Freelancer gets:</div>
                <div class="font-bold">
                    {insertThousandSeparator(freelancerShare) + 'sats'}
                </div>
                <div class="underline">SatShoot gets:</div>
                <div class="font-bold">
                    {insertThousandSeparator(satshootShare) +
                        ' + ' +
                        insertThousandSeparator(pledgedAmount) +
                        ' = ' +
                        insertThousandSeparator(satshootShare + pledgedAmount) +
                        'sats'}
                </div>
            </div>
            <div class="flex w-full justify-between">
                <button
                    type="button"
                    class="btn btn-sm sm:btn-md min-w-24 bg-error-300-600-token"
                    on:click={() => modalStore.close()}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    on:click={pay}
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
                            <div class="font-bold">Pay</div>
                        </div>
                    {/if}
                    <div class="font-bold">(Public Zap)</div>
                </button>
            </div>
            {#if errorMessage}
                <div class="text-error-500 text-center">{errorMessage}</div>
            {/if}
        </div>
    {:else if !ticket}
        <h2 class="h2 font-bold text-center text-error-300-600-token">Error: Ticket is missing!</h2>
    {:else if !offer}
        <h2 class="h2 font-bold text-center text-error-300-600-token">Error: Offer is missing!</h2>
    {/if}
{/if}
