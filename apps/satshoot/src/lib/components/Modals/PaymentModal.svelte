<script lang="ts">
    import ndk, { DEFAULTRELAYURLS } from "$lib/stores/ndk";
    // import {init, launchPaymentModal, onModalClosed} from "@getalby/bitcoin-connect";
    import { TicketEvent } from '$lib/events/TicketEvent';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { type SvelteComponent, tick } from "svelte";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import OfferCard from "../OrderBook/OfferCard.svelte";
    import { SatShootPubkey } from "$lib/utils/misc";

    import { insertThousandSeparator } from '$lib/utils/misc';
    import { NDKKind, type NDKFilter } from "@nostr-dev-kit/ndk";
    import currentUser from "$lib/stores/user";

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    /** Exposes parent props to this component. */
    export let parent: SvelteComponent;
    export let ticket: TicketEvent;
    export let offer: OfferEvent | null = null;

    let amount = 0;
    let pledgedAmount = 0;
    let satshootShare = 0;
    let troubleshooterShare = 0;

    $: if (offer) {
        satshootShare = Math.floor(amount * offer.pledgeSplit / 100);
        troubleshooterShare = amount - satshootShare;
    }

    let paying = false;

    const popupClasses = 'card w-80 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto';
    let errorMessage = '';
     
    // For tooltip    
    const popupPledge: PopupSettings = {
        event: 'click',
        target: 'popupPledge',
        placement: 'bottom'
    };

    async function pay() {
        if (ticket && offer) {
            try {
                paying = true;
                await tick();

                // const closedToast: ToastSettings = {
                //     message: 'Ticket Closed!',
                //     timeout: 7000,
                //     background: 'bg-success-300-600-token',
                // };
                // toastStore.trigger(closedToast);
                //
                // const checkWallet: ToastSettings = {
                //     message: 'Check your Wallet to make sure the Payment is complete!',
                //     autohide: false,
                //     background: 'bg-warning-300-600-token',
                // };
                // toastStore.trigger(checkWallet);
                if (troubleshooterShare === 0) {
                    errorMessage = 'Cannot pay 0 sats!';
                    paying = false;
                    return;
                }

                const troubleshooterShareMillisats = troubleshooterShare * 1000;
                const satshootSumMillisats = (satshootShare + pledgedAmount) * 1000;
                const invoices: Map<string, string> = new Map();
                const paid: Map<string, boolean> = new Map();
                paid.set('troubleshooter', false);
                paid.set('satshoot', false);
                const troubleshooterUser = $ndk.getUser({pubkey: offer.pubkey});
                const satShootUser = $ndk.getUser({pubkey: SatShootPubkey});

                const troubleshooterZapConfig = await troubleshooterUser.getZapConfiguration();
                const satshootZapConfig = await satShootUser.getZapConfiguration();

                try {

                    const troubleshooterInvoice = await $ndk.zap(
                        offer,
                        troubleshooterShareMillisats,
                        'satshoot',
                    );
                    console.log('troubleshooterInvoice', troubleshooterInvoice)
                    if (troubleshooterInvoice) {
                        invoices.set('troubleshooter', troubleshooterInvoice);
                    }
                } catch {
                    errorMessage = 'Could not zap Troubleshooter: Failed to fetch payment invoice'
                    paying = false;
                    return;
                }

                try {
                    // TEST
                    // const pablof7z = $ndk.getUser({
                        // npub: 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft'
                    // });
                    if (satshootSumMillisats > 0) {
                        const satshootInvoice = await $ndk.zap(
                            satShootUser,
                            satshootSumMillisats,
                            'satshoot',
                            // Tagging ticket
                            [['e', ticket.id]]
                        );
                        if (satshootInvoice) {
                            invoices.set('satshoot', satshootInvoice);
                        }
                        console.log('satshootInvoice', satshootInvoice)
                    }
                } catch(e) {
                    console.log(e)
                    errorMessage = 'Could not zap SatShoot: Failed to fetch payment invoice'
                    paying = false;
                    return;
                }

                const {init, launchPaymentModal, onModalClosed} = await import('@getalby/bitcoin-connect');
                // Init getalby bitcoin-connect
                init({appName: 'SatShoot'});

                // Try to pay invoices and check for zap receipts of zappers
                for (const key of invoices.keys()) {
                    launchPaymentModal({
                        invoice: invoices.get(key) as string,
                        // NOTE: only fired if paid with WebLN
                        onPaid: ({preimage}) => paid.set(key, true), 
                    });

                    await new Promise<void>(resolve => {
                        const unsub = onModalClosed(() => {
                            resolve();
                            unsub();
                        });
                    });

                    // Fetch zap receipts if possible
                    const filter:NDKFilter = {
                        kinds: [NDKKind.Zap],
                        since: Math.floor(Date.now() / 1000)
                    };
                    if (key === 'troubleshooter' && troubleshooterZapConfig) {
                        console.log('trying to fetch troubleshooter zap receipt...')
                        if (troubleshooterZapConfig.nostrPubkey) {
                            filter['authors'] = [troubleshooterZapConfig.nostrPubkey];
                        }
                        filter['#p'] = [offer.pubkey];
                        // NDK tags zap requests with both 'e' and 'a' tags
                        // for param repl. events. we look for the offer's 'e' tag
                        filter['#e'] = [offer.id];
                        try {
                            const zapReceiptEvent = await $ndk.fetchEvent(filter);
                            console.log(zapReceiptEvent)
                            if (zapReceiptEvent) {
                                const validReceipt = (
                                    zapReceiptEvent.pubkey === troubleshooterZapConfig.nostrPubkey
                                );
                                paid.set(key, validReceipt);
                            }
                        } catch(e) {
                            errorMessage = "Could not fetch troubleshooter's zap receipt: " + e;
                        }
                    } else if (key === 'satshoot' && satshootZapConfig) {
                        console.log('trying to fetch SatShoot zap receipt...')
                        if (satshootZapConfig.nostrPubkey) {
                            filter['authors'] = [satshootZapConfig.nostrPubkey];
                        }
                        filter['#p'] = [SatShootPubkey];
                        // NDK tags zap requests with both 'e' and 'a' tags
                        // for param repl. events. we look for the ticket's 'e' tag
                        filter['#e'] = [ticket.id];
                        try {
                            const zapReceiptEvent = await $ndk.fetchEvent(filter);
                            console.log(zapReceiptEvent)
                            if (zapReceiptEvent) {
                                const validReceipt = (
                                    zapReceiptEvent.pubkey === satshootZapConfig.nostrPubkey
                                );
                                paid.set(key, validReceipt);
                            }
                        } catch(e) {
                            errorMessage = "Could not fetch SatShoot's zap receipt: " + e;
                        }
                    }
                }

                if (paid.get('troubleshooter')) {
                    const t: ToastSettings = {
                        message: 'Troubleshooter Paid!',
                        autohide: false,
                        background: 'bg-success-300-600-token',
                    };
                    toastStore.trigger(t);
                } else {
                    const t: ToastSettings = {
                        message: 'Troubleshooter Payment might have failed!',
                        autohide: false,
                        background: 'bg-warning-300-600-token',
                    };
                    toastStore.trigger(t);
                }
                if (paid.get('satshoot')) {
                    const t: ToastSettings = {
                        message: 'SatShoot Paid!',
                        autohide: false,
                        background: 'bg-success-300-600-token',
                    };
                    toastStore.trigger(t);
                } else {
                    const t: ToastSettings = {
                        message: 'SatShoot Payment might have failed!',
                        autohide: false,
                        background: 'bg-warning-300-600-token',
                    };
                    toastStore.trigger(t);
                }
                modalStore.close();
            } catch(e) {
                console.log(e)
                paying = false;
            }
        } else {
            paying = false;
            const t: ToastSettings = {
                message: 'Error: Could could not find ticket and offer!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
        }
    }

</script>

{#if $modalStore[0]}
    {#if ticket}
        <div class="card p-4">
            <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Make Payment</h4>
            <div class="flex flex-col justify-center min-w-60 gap-y-4">
                {#if offer}
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
                    <label class="">
                        <span class="font-bold">Pay for the Troubleshooting</span>
                        <div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
                            <div class="input-group-shim">
                                <i class="fa-brands fa-bitcoin text-3xl"/>
                            </div>
                            <input 
                            class="text-lg max-w-md"
                            type="number"
                            min="0"
                            max="100_000_000"
                            placeholder="Amount"
                            bind:value={amount}
                        />
                            <div>sats</div>
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
                                <div class="{popupClasses}">
                                    <p>
                                        Support the development of SatShoot.
                                    </p>
                                    <p>
                                        Your support will be visible as part of your Reputation
                                    </p>
                                    <div class="arrow bg-primary-300-600-token" />
                                </div>
                            </div>
                        </div>
                        <label class="">
                            <div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
                                <div class="input-group-shim">
                                    <i class="fa-brands fa-bitcoin text-3xl"/>
                                </div>
                                <input 
                                class="text-lg max-w-md"
                                type="number"
                                min="0"
                                max="100_000_000"
                                placeholder="Amount"
                                bind:value={pledgedAmount}
                            />
                                <div>sats</div>
                            </div>
                        </label>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="grid grid-cols-2 gap-x-8">
                            <div class="flex flex-col">
                                <div class="underline">Troubleshooter gets:</div>
                                <div class="font-bold">
                                    {insertThousandSeparator(troubleshooterShare) + 'sats'}
                                </div>
                            </div>
                            <div class="flex flex-col">
                                <div class="underline">SatShoot gets:</div>
                                <div class="font-bold">
                                    {
                                        insertThousandSeparator(satshootShare) + ' + '
                                        + insertThousandSeparator(pledgedAmount) + ' = '
                                        + insertThousandSeparator(satshootShare + pledgedAmount) + 'sats'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
                <div class="grid grid-cols-[30%_1fr] gap-x-2">
                    <button 
                        type="button"
                        class="btn btn-sm sm:btn-md bg-error-300-600-token"
                        on:click={()=> modalStore.close()}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        on:click={pay}
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                        disabled={paying}
                    >
                        {#if paying}
                            <span>
                                <ProgressRadial value={undefined} stroke={60} meter="stroke-error-500"
                                    track="stroke-error-500/30" strokeLinecap="round" width="w-8" />
                            </span>
                        {:else}
                            <span class="font-bold">Pay</span>
                        {/if}
                    </button>
                </div>
                {#if errorMessage}
                    <div class="text-error-500 text-center">{errorMessage}</div>
                {/if}
            </div>
        </div>
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600-token">
            Error: Ticket is missing!
        </h2>
    {/if}
{/if}
