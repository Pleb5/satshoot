<script lang="ts">
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import ShareJobModal from '../Modals/ShareJobModal.svelte';
    import { TicketEvent } from '$lib/events/TicketEvent';

    const modalStore = getModalStore();

    export let job: TicketEvent;

    function handleShare() {
        const modalComponent: ModalComponent = {
            ref: ShareJobModal,
            props: { job },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <div class="w-full flex flex-row flex-wrap gap-[10px]">
            <Button
                classes="bg-[rgba(0,0,0,0.1)] text-[rgba(0,0,0,0.5)] scale-[1] w-auto flex-grow justify-start"
                on:click={handleShare}
            >
                <i class="bx bxs-share" />
                Share
            </Button>
        </div>
    </div>
</div>
