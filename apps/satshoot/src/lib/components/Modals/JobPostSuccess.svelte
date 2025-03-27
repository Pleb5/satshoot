<script lang="ts">
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import ShareJobModal from './ShareJobModal.svelte';

    interface Props {
        job: TicketEvent;
    }

    let { job }: Props = $props();

    const modalStore = getModalStore();

    function handleConfirm() {
        const modalComponent: ModalComponent = {
            ref: ShareJobModal,
            props: { job },
        };

        const shareModal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.clear();
        modalStore.trigger(shareModal);
    }
</script>

{#if $modalStore[0]}
    <Popup title="Success!">
        <div class="w-full flex flex-col">
            <div class="w-full py-[10px] px-[5px]">
                <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px]">
                    <p class="w-full">Job posted successfully!</p>
                    <p class="w-full">
                        <strong>Share Job as Text Note?</strong> It will show up in your feed on popular
                        clients.
                    </p>

                    <Button on:click={handleConfirm}>Of course!</Button>
                    <Button variant="outlined" on:click={() => modalStore.close()}>
                        No thanks
                    </Button>
                </div>
            </div>
        </div>
    </Popup>
{/if}
