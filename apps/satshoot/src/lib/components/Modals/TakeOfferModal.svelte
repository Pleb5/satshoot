<script lang="ts">
    import { createToaster } from '@skeletonlabs/skeleton-svelte';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import ndk from '$lib/stores/ndk';
    import { tick } from 'svelte';
    import OfferTakenModal from './OfferTakenModal.svelte';
    import { goto } from '$app/navigation';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    const toaster = createToaster();

    interface Props {
        isOpen: boolean;
        job: TicketEvent;
        offer: OfferEvent;
    }

    let { isOpen = $bindable(), job, offer }: Props = $props();

    let takingOffer = $state(false);
    let showOfferTakenModal = $state(false);

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
                isOpen = false;
                showOfferTakenModal = true;

                // Navigate to job messages
                goto('/messages/' + job.encode());
            } catch (e) {
                console.log(e);
                toaster.error({
                    title: 'Error while accepting Offer! Fix connection with Relays and try again!',
                });

                isOpen = false;
            }
        } else {
            toaster.error({
                title: 'Cannot accept Offer, Job not found!',
            });
            isOpen = false;
        }
    }
</script>

<ModalWrapper bind:isOpen title="Take Offer">
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
                <Button grow onClick={takeOffer} disabled={takingOffer}>
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
</ModalWrapper>

<OfferTakenModal bind:isOpen={showOfferTakenModal} />
