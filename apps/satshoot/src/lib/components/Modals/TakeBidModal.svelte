<script lang="ts">
    import { JobEvent } from '$lib/events/JobEvent';
    import type { BidEvent } from '$lib/events/BidEvent';
    import ndk from '$lib/stores/session';
    import { tick } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { bidTakenState } from '$lib/stores/modals';

    interface Props {
        isOpen: boolean;
        job: JobEvent;
        bid: BidEvent;
    }

    let { isOpen = $bindable(), job, bid }: Props = $props();

    let takingBid = $state(false);

    async function takeBid() {
        if (job && bid) {
            // User chose to take bid
            let jobToPublish = new JobEvent($ndk);
            jobToPublish.tags = job.tags;
            jobToPublish.description = job.description;
            // Important part! This also sets status to in progress
            jobToPublish.acceptedBidAddress = bid.bidAddress;

            const jobId = job.encode();

            try {
                takingBid = true;
                await tick();

                await jobToPublish.publish();

                bidTakenState.set({
                    showModal: true,
                    jobId,
                });

                takingBid = false;
                isOpen = false;
            } catch (e) {
                console.error(e);
                toaster.error({
                    title: `Error while accepting Bid!`,
                    description: e,
                });

                isOpen = false;
            }
        } else {
            toaster.error({
                title: 'Cannot accept Bid, Job not found!',
            });
            isOpen = false;
        }
    }
</script>

<ModalWrapper bind:isOpen title="Take Bid">
    <div class="w-full flex flex-col">
        <!-- popups Share Job Post start -->
        <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
            <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px]">
                <p class="w-full font-[600]">Do you really want to take this bid?</p>
                <p
                    class="w-full font-[600] text-center py-[5px] px-[10px] rounded-[4px] border-[1px] border-black-100 dark:border-white-100 text-orange-600"
                >
                    You agree to pay the fee listed on the Bid!
                </p>
            </div>
            <div class="w-full flex flex-row gap-[5px]">
                <Button grow onClick={takeBid} disabled={takingBid}>
                    {#if takingBid}
                        <span>
                            <ProgressRing />
                        </span>
                    {:else}
                        Take Bid
                    {/if}
                </Button>
            </div>
        </div>
        <!-- popups Share Job Post end -->
    </div>
</ModalWrapper>
