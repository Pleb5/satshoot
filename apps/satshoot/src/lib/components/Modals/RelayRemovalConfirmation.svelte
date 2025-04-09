<script lang="ts">
    import { createToaster } from '@skeletonlabs/skeleton-svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    const toaster = createToaster();

    interface Props {
        isOpen: boolean;
        url: string; // Relay URL to remove
        onConfirm: () => Promise<void>; // Callback function to invoke on confirmation
    }

    let { isOpen = $bindable(), url, onConfirm }: Props = $props();

    let posting = $state(false);

    async function handleConfirm() {
        try {
            posting = true;
            await onConfirm(); // Invoke the parent's callback function
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

<ModalWrapper bind:isOpen title="Confirm Removal of Relay">
    <div class="w-full flex flex-col gap-[15px]">
        <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px] mt-[10px]">
            <div
                class="w-full py-[5px] px-[10px] rounded-[6px] bg-orange-500 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
            >
                <p class="font-[600] text-[16px] text-white">
                    Do you really want to remove {url.replace('wss://', '').slice(0, -1)}?
                </p>
            </div>
        </div>
        <div class="w-full flex items-center justify-center gap-[10px]">
            <Button grow variant="outlined" on:click={() => (isOpen = false)}>Cancel</Button>
            <Button
                classes="bg-red-600 hover:bg-red-500 text-white"
                grow
                on:click={handleConfirm}
                disabled={posting}
            >
                <i class="bx bx-trash"></i>
                <span>Remove</span>
                {#if posting}
                    <ProgressRing color="white" />
                {/if}
            </Button>
        </div>
    </div>
</ModalWrapper>
