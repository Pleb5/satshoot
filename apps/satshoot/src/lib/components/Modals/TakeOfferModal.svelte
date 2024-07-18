<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent } from "$lib/events/TicketEvent";

    import { getToastStore } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings, ModalSettings } from '@skeletonlabs/skeleton';
    import { ProgressRadial, type ModalComponent } from '@skeletonlabs/skeleton';

    import { type SvelteComponent, tick } from "svelte";
    import { goto } from "$app/navigation";

    import OfferTakenModal from "$lib/components/Modals/OfferTakenModal.svelte";

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    /** Exposes parent props to this component. */
    export let parent: SvelteComponent;
    export let ticket: TicketEvent;
    export let offer: OfferEvent;

    let takingOffer = false;

    async function takeOffer() {
        if (ticket && offer) {
            // User chose to take offer
            let ticketToPublish = new TicketEvent($ndk);
            ticketToPublish.tags = ticket.tags;
            ticketToPublish.description = ticket.description;
            // Important part! This also sets status to in progress
            ticketToPublish.acceptedOfferAddress = offer.offerAddress;

            try {
                takingOffer = true;
                await tick();

                await ticketToPublish.publish();

                takingOffer = false;
                modalStore.close();

                const modalComponent: ModalComponent = {
                    ref: OfferTakenModal,
                };

                const modal: ModalSettings = {
                    type: 'component',
                    component: modalComponent,
                };
                modalStore.trigger(modal);

                // Navigate to ticket messages
                goto('/messages/' + ticket.encode());

            } catch(e) {
                console.log(e)
                const t: ToastSettings = {
                    message: 'Error while accepting Offer! Fix connection with Relays and try again!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
                modalStore.close();
            }
        } else {
            const t: ToastSettings = {
                message: 'Cannot accept Offer, Ticket not found!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
            modalStore.close();
        }
    }

</script>

{#if $modalStore[0]}
    {#if ticket}
        <div class="card p-4">
            <h4 class="h4 text-center mb-2">{'Take Offer'}</h4>
            <div class="flex flex-col justify-center gap-y-4">
                <div class="text-center font-bold">
                    Do really want to take this Offer?
                </div>
                <strong class="text-error-500 text-center">
                    You agree to pay the fee listed on the Offer!
                </strong>
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
                        on:click={takeOffer}
                        class="btn btn-sm sm:btn-md bg-tertiary-300-600-token"
                        disabled={takingOffer}
                    >
                        {#if takingOffer}
                            <span>
                                <ProgressRadial value={undefined} stroke={60} meter="stroke-error-500"
                                    track="stroke-error-500/30" strokeLinecap="round" width="w-8" />
                            </span>
                        {:else}
                            <span>Take Offer</span>
                        {/if}

                    </button>
                </div>
            </div>
        </div>
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600-token">
            Error: Ticket is missing!
        </h2>
    {/if}
{/if}
