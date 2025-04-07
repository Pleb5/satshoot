<script lang="ts">
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import { createToaster } from '@skeletonlabs/skeleton-svelte';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import ndk from '$lib/stores/ndk';
    import { tick } from 'svelte';
    import OfferTakenModal from './OfferTakenModal.svelte';
    import { goto } from '$app/navigation';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const toaster = createToaster();
    const modalStore = getModalStore();

    interface Props {
        job: TicketEvent;
        offer: OfferEvent;
    }

    let { job, offer }: Props = $props();

    let takingOffer = $state(false);

    async function takeOffer() {
        if (job && offer) {
            // User chose to take offer
            let jobToPublish = new TicketEvent($ndk);
            jobToPublish.tags = job.tags;
            jobToPublish.description = job.description;
            // Important part! This also sets status to in progress
            jobToPublish.acceptedOfferAddress = offer.offerAddress;

            try {
                takingOffer = true;
                await tick();

                await jobToPublish.publish();

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

                // Navigate to job messages
                goto('/messages/' + job.encode());
            } catch (e) {
                console.log(e);
                toaster.error({
                    title: 'Error while accepting Offer! Fix connection with Relays and try again!',
                });

                modalStore.close();
            }
        } else {
            toaster.error({
                title: 'Cannot accept Offer, Job not found!',
            });
            modalStore.close();
        }
    }
</script>

{#if $modalStore[0]}
    <Popup title="Take Offer">
        <div class="w-full flex flex-col">
            <!-- popups Share Job Post start -->
            <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px]">
                    <p class="w-full font-[600]">Do you really want to take this offer?</p>
                    <p
                        class="w-full font-[600] text-center py-[5px] px-[10px] rounded-[4px] border-[1px] border-black-100 dark:border-white-100 text-orange-600"
                    >
                        You agree to pay the fee listed on the Offer!
                    </p>
                </div>
                <div class="w-full flex flex-row gap-[5px]">
                    <Button grow on:click={takeOffer} disabled={takingOffer}>
                        {#if takingOffer}
                            <span>
                                <ProgressRing />
                            </span>
                        {:else}
                            Take Offer
                        {/if}
                    </Button>
                </div>
            </div>
            <!-- popups Share Job Post end -->
        </div>
    </Popup>
{/if}
