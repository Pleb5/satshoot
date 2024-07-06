<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import {init, launchPaymentModal, onModalClosed} from "@getalby/bitcoin-connect";
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
                if (offer) {
                    const troubleshooterShareMillisats = troubleshooterShare * 1000;
                    const satshootSumMillisats = (satshootShare + pledgedAmount) * 1000;
                    const invoices: string[] = [];

                    try {
                        const troubleshooterInvoice = await $ndk.zap(offer, troubleshooterShareMillisats);
                        console.log('troubleshooterInvoice', troubleshooterInvoice)
                        if (troubleshooterInvoice) {
                            invoices.push(troubleshooterInvoice);
                        }
                    } catch {
                        errorMessage = 'Could not zap Troubleshooter: Failed to fetch payment invoice'
                    }

                    try {
                        // const pablof7z = $ndk.getUser({npub: 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft'})
                        const satShootUser = $ndk.getUser({pubkey: SatShootPubkey});
                        // zap satshoot user with ticket event tagged in 'e' tag. No zap comment
                        const satshootInvoice = await $ndk.zap(
                            satShootUser, satshootSumMillisats,
                            undefined, [['e', ticket.id]]
                        );
                        if (satshootInvoice) {
                            invoices.push(satshootInvoice);
                        }
                        console.log('satshootInvoice', satshootInvoice)
                    } catch {
                        errorMessage = 'Could not zap SatShoot: Failed to fetch payment invoice'
                    }

                    for (const invoice of invoices) {
                        launchPaymentModal({invoice: invoice})

                        await new Promise<void>(resolve => {
                            const unsub = onModalClosed(() => {
                                resolve();
                                unsub();
                            });
                        });

                        // TODO: Load invoices like Coracle but with ndk
                        // load({
                        //     relays,
                        //     onEvent: callback,
                        //     filters: [{kinds: [9735], authors: [zapper.nostrPubkey], "#p": [pubkey], since}],
                        // })
                    }
                }

                modalStore.close();
            } catch(e) {
                console.log(e)
                paying = false;
            }
        } else {
            paying = false;
            const t: ToastSettings = {
                message: 'Error: Could could not find ticket to close!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
        }
    }

    // Init getalby bitcoin-connect
    init({appName: 'SatShoot'})
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
