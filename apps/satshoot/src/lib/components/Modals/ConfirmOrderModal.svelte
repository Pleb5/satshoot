<script lang="ts">
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import { toaster } from '$lib/stores/toaster';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        service: ServiceEvent;
        onConfirm: (note: string) => Promise<void>; // Callback function to invoke on confirmation
    }

    let { isOpen = $bindable(), service, onConfirm }: Props = $props();

    let posting = $state(false);
    let noteText = $state('');

    async function handleConfirm() {
        try {
            posting = true;
            await onConfirm(noteText); // Invoke the parent's callback function
        } catch (e) {
            toaster.error({
                title: 'Error: ' + e,
            });
        } finally {
            posting = false;
            isOpen = false; // Close the modal after confirmation
        }
    }
</script>

<ModalWrapper bind:isOpen title="Confirm Create Order">
    <div class="w-full flex flex-col gap-[15px]">
        <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px] mt-[10px]">
            <div
                class="w-full py-[5px] px-[10px] rounded-[6px] border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
            >
                <p>
                    Do you really want to create an order on service
                    <span class="font-bold">"{service.title}"</span>
                    <span>?</span>
                </p>
            </div>
            <Input
                bind:value={noteText}
                placeholder="Note for Freelancer (Optional)"
                classes="min-h-[100px]"
                fullWidth
                textarea
            />
        </div>

        <div class="w-full flex items-center justify-center gap-[10px]">
            <Button grow variant="outlined" onClick={() => (isOpen = false)}>Cancel</Button>
            <Button grow onClick={handleConfirm} disabled={posting}>
                <span>Yes</span>
                {#if posting}
                    <ProgressRing color="white" />
                {/if}
            </Button>
        </div>
    </div>
</ModalWrapper>
