<script lang="ts">
	import { onMount, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, type NDKSigner } from '@nostr-dev-kit/ndk';
    import { OfferEvent, OfferStatus, Pricing } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    
	import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';

    import { goto } from '$app/navigation';
    import { navigating } from '$app/stores';
    import tabStore from '$lib/stores/tab-store';
    import { offerTabStore } from "$lib/stores/tab-store";
    import { insertThousandSeparator } from '$lib/utils/misc';

	// Props
	/** Exposes parent props to this component. */
	// export let parent: SvelteComponent;

    export let ticket: TicketEvent;
    const ticketAddress = ticket.ticketAddress;

    export let offerToEdit: OfferEvent | undefined = undefined;

	const modalStore = getModalStore();
    const toastStore = getToastStore();

    let pricingMethod: Pricing;
    let amount = 0;
    let pledgeSplit = 0;

    $: pledgedShare = Math.floor(amount * (pledgeSplit / 100));
    $: troubleshooterShare = amount - pledgedShare;

    let description = '';
    let sendDm = true;

    let errorText = '';
    let posting = false;
    
    const cBase = 'card bg-surface-100-800-token w-screen/2 h-screen/2 p-4 flex justify-center items-center';

    async function postOffer() {
        if (!validate()) {
            return;
        }
        posting = true;
        const offer = new OfferEvent($ndk)

        offer.pricing = pricingMethod;
        offer.amount = amount;
        offer.setPledgeSplit(pledgeSplit, $currentUser!.pubkey);
        offer.description = description;

        offer.referencedTicketAddress = ticketAddress as string;

        // Only generate new d-tag if we are not editing an existing one
        if (!offerToEdit) {
            // generate unique d-tag
            offer.generateTags();
        } else {
            offer.removeTag('d');
            offer.tags.push(['d', offerToEdit.tagValue('d') as string]);
        }

        try {
            console.log('offer', offer)
            const relaysPublished = await offer.publish();

            if (sendDm) {
                const dm = new NDKEvent($ndk);
                dm.kind = NDKKind.EncryptedDirectMessage;
                dm.tags.push(['t', ticketAddress!]);
                const ticketHolder = ticket.pubkey;
                const ticketHolderUser = $ndk.getUser({pubkey: ticketHolder});

                if (!ticketHolder || !ticketHolderUser){
                    throw new Error('Could not identify Ticket Holder, sending DM failed!');
                }

                dm.tags.push(['p', ticketHolder]);

                const content = `SatShoot Offer update on Ticket: ${ticket.title} | \n\n`
                    + `Amount: ${offer.amount}${offer.pricing === Pricing.Absolute ? 'sats' : 'sats/min'} | \n`
                    + `Description: ${offer.description}`;
                console.log('dm content', content)
                dm.content = await ($ndk.signer as NDKSigner).encrypt(ticketHolderUser, content);
                console.log('encrypted dm', dm)

                const relays = await dm.publish();
                console.log('relays published', relays)
            }

            posting = false;
            
            $offerTabStore = OfferStatus.Pending;

            const t: ToastSettings = {
                message: 'Offer Posted!',
                timeout: 4000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            if ( !($currentUser?.profile?.lud16) ) {
                console.log($currentUser?.profile)

                let toastId:string;
                const t: ToastSettings = {
                    message: 'Set up an LN Address to receive payments!',
                    background: 'bg-warning-300-600-token',
                    autohide: false,
                    action: {
                        label: 'Go to Profile',
                        response: () => {
                            if (toastId) {
                                toastStore.close(toastId);
                            }
                            goto("/" + $currentUser!.npub);
                        },
                    }
                }
                toastId = toastStore.trigger(t);
            }

            if ($modalStore[0].response) {
                $modalStore[0].response(true);
                modalStore.close();
            }

            modalStore.close();

            goto('/my-offers');
        } catch(e) {
            posting = false;
            const errorMessage = 'Error happened while publishing Offer:' + e;
            
            const t: ToastSettings = {
                message: errorMessage,
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

            if ($modalStore[0].response) {
                $modalStore[0].response(false);
                modalStore.close();
            }
        }
    }

    function validate():boolean {
        let valid = true;
        errorText = '';
        if (amount < 0) {
            valid = false;
            errorText = 'Amount below 0!'
        } else if (amount > 100_000_000) {
            valid = false;
            errorText = 'Amount cannot exceed 100M sats!'
        } else if (pledgeSplit < 0) {
            valid = false;
            errorText = 'Pledge split below 0!';
        } else if (pledgeSplit > 100) {
            valid = false;
            errorText = 'Pledge split above 100% !';
        }
        return valid;
    }

    $: if($navigating) {
        if ($navigating.to?.url.pathname === '/my-tickets') {
            $tabStore = 1; 
        }
    }

    onMount(()=>{
        if (offerToEdit) {
            pricingMethod = offerToEdit.pricing;
            amount = offerToEdit.amount;
            pledgeSplit = offerToEdit.pledgeSplit;
            description = offerToEdit.description;
        }
    });

    // For tooltip    
    const popupPledgeSplit: PopupSettings = {
        event: 'click',
        target: 'popupPledgeSplit',
        placement: 'bottom'
    };

</script>

{#if $modalStore[0]}
<div class="{cBase}">
    {#if ticketAddress}
            <div class="grid grid-cols-1 p-4">
                <h2 class="h2 text-center">Create Offer</h2>
                <!-- Pricing -->
                <label class="my-4">
                    <span>Pricing Method</span>
                    <select class="select" bind:value={pricingMethod}>
                        <option value={Pricing.Absolute}>Absolute Price(sats)</option>
                        <option value={Pricing.SatsPerMin}>Time-based Price(sats/minute)</option>
                    </select>
                </label>
                <!-- Amount -->
                <label class="my-4">
                    <span>Amount</span>
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
                        <div>{pricingMethod ? 'sats/min' : 'sats'}</div>
                    </div>
                </label>
                <!-- Pledge Split -->
                <div class="flex justify-start gap-x-1">
                    <span class="mr-2">Pledge Split</span>
                    <i 
                    class="text-primary-300-600-token fa-solid fa-circle-question text-xl
                    [&>*]:pointer-events-none" 
                    use:popup={popupPledgeSplit}
                />
                    <div data-popup="popupPledgeSplit">
                        <div class="card w-80 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto">
                            <p>
                                Pledge a percentage of your potential revenue to support development.
                            </p>
                            <br/>
                            <p>
                                The percentage pledged will show up for the potential Client.
                            </p>
                            <div class="arrow bg-primary-300-600-token" />
                        </div>
                    </div>
                </div>
                <label class="mb-4 mt-1">
                    <div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
                        <div class="input-group-shim">
                            <i class="fa-brands fa-bitcoin text-3xl"/>
                        </div>
                        <input 
                        class="text-lg max-w-md"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Percentage"
                        bind:value={pledgeSplit}
                    />
                        <div>%</div>
                    </div>
                </label>
                <div class="flex justify-between">
                    <div class="flex flex-col">
                        <div class="underline">You get:</div>
                        <div class="font-bold">
                            {
                                insertThousandSeparator(troubleshooterShare) + 
                                (pricingMethod ? 'sats/min' : 'sats')
                            }
                        </div>
                    </div>
                    <div class="flex flex-col">
                        <div class="underline">You pledge:</div>
                        <div class="font-bold">
                            {
                                insertThousandSeparator(pledgedShare) + 
                                (pricingMethod ? 'sats/min' : 'sats')
                            }
                        </div>
                    </div>
                </div>

                <!-- Description -->
                <label class="label max-w-xl mt-4 mb-2">
                    <span>Offer Description</span>
                    <textarea 
                    class="textarea"
                    rows="3"
                    placeholder="Describe why you should get the job"
                    bind:value={description}
                />
                </label>
                <!-- Send DM -->
                <div class="mb-6">
                    <label class="flex items-center space-x-2">
                        <input
                            class="checkbox"
                            type="checkbox" 
                            bind:checked={sendDm}
                        />
                        <p>Send Offer as NIP04 DM to Ticket Holder</p>
                    </label>
                </div>
                <!-- Cancel and Post Offer buttons -->
                <div class="flex gap-x-4 justify-center mb-2">
                    <button 
                        type="button"
                        class="btn btn-sm sm:btn-md bg-error-300-600-token"
                        on:click={()=> modalStore.close()}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        class="btn font-bold bg-success-400-500-token w-72" 
                        on:click={postOffer}
                        disabled={posting}
                    >
                        {#if posting}
                            <span>
                                <ProgressRadial value={undefined} stroke={60} meter="stroke-tertiary-500"
                                track="stroke-tertiary-500/30" strokeLinecap="round" width="w-8"/>
                            </span>
                        {:else}
                            <span>Post Offer</span>
                        {/if}
                    </button>
                </div>
                {#if errorText}
                    <h4 class="h4 font-bold text-center text-error-300-600-token">
                        {errorText}
                    </h4>
                {/if}
            </div>
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600-token">
            Error: Ticket is missing!
        </h2>
    {/if}
</div>
{/if}
