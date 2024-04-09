<script lang="ts">
	import { onMount, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKRelaySet } from '@nostr-dev-kit/ndk';
    import { OfferEvent, Pricing } from '$lib/events/OfferEvent';
    
	// Stores
	import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

    import { goto } from '$app/navigation';
    import { navigating } from '$app/stores';
    import tabStore from '$lib/stores/tab-store';

	// Props
	/** Exposes parent props to this component. */
	// export let parent: SvelteComponent;

    export let ticketAddress: string | undefined = undefined;

    export let offerToEdit: OfferEvent | undefined = undefined;

	const modalStore = getModalStore();
    const toastStore = getToastStore();

    let pricingMethod: Pricing;

    let amount: number = 0;

    let description: string = '';

    let errorText = '';
    let posting = false;
    
    const cBase = 'card bg-surface-100-800-token w-screen/2 h-screen/2 p-8 flex justify-center items-center';

    async function postOffer() {
        posting = true;
        const offer = new OfferEvent($ndk)

        offer.pricing = pricingMethod;
        offer.amount = amount;
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

            const relaysPublished = await offer.publish(
                new NDKRelaySet(new Set($ndk.pool.relays.values()), $ndk)
            );
            posting = false;

            const t: ToastSettings = {
                message: 'Offer Posted!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            if ($modalStore[0].response) {
                $modalStore[0].response(true);
                modalStore.close();
            }

            modalStore.close();

            goto('/my-tickets');
        } catch(e) {
            posting = false;
            errorText = 'Error happened while publishing Offer!';
            if ($modalStore[0].response) {
                $modalStore[0].response(false);
                modalStore.close();
            }
        }
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
            description = offerToEdit.description;
        }
    });

</script>

{#if $modalStore[0]}
<div class="{cBase}">
    {#if ticketAddress}
            <div class="grid grid-cols-1">
                <h2 class="h2 text-center">Create Offer</h2>
                <form on:submit|preventDefault={ postOffer }>
                        <!-- Pricing -->
                    <label class="m-4">
                        <span>Pricing Method</span>
                        <select class="select" bind:value={pricingMethod}>
                            <option value={Pricing.Absolute}>Absolute Price(sats)</option>
                            <option value={Pricing.SatsPerMin}>Time-based Price(sats/minute)</option>
                        </select>
                    </label>
                    <!-- Amount -->
                    <label class="m-4">
                        <span>Amount</span>
                        <div class="input-group input-group-divider grid-cols-[auto_1fr_auto]">
                            <div class="input-group-shim">
                                <i class="fa-brands fa-bitcoin text-3xl"/>
                            </div>
                            <input 
                                class="text-lg max-w-md"
                                type="number"
                                min="0"
                                max="2100000000000000"
                                placeholder="Amount"
                                bind:value={amount}
                            />
                            <div>{pricingMethod ? 'sats/min' : 'sats'}</div>
                        </div>
                    </label>
                    <!-- Description -->
                    <label class="label max-w-xl m-4">
                        <span>Offer Description</span>
                        <textarea 
                            class="textarea"
                            rows="4"
                            placeholder="Describe how you would solve the issue and why you should get the job"
                            bind:value={description}
                        />
                    </label>
                    <div class="flex justify-center mb-8">
                        <button 
                            type="submit"
                            class="btn font-bold bg-success-400-500-token w-72 mt-4" 
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
                </form>
            </div>
        {#if errorText}
            <h2 class="h2 font-bold text-center text-error-300-600-token">
                {errorText}
            </h2>
        {/if}
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600-token">
            Error: Ticket is missing!
        </h2>
    {/if}
</div>
{/if}
