<script lang="ts">
    import { getModalStore, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    interface Props {
        url: string; // Relay URL to remove
        onConfirm: () => Promise<void>; // Callback function to invoke on confirmation
    }

    let { url, onConfirm }: Props = $props();

    let posting = $state(false);

    async function handleConfirm() {
        try {
            posting = true;
            await onConfirm(); // Invoke the parent's callback function
        } catch (e) {
            const t: ToastSettings = {
                message: 'Error: ' + e,
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
        } finally {
            posting = false;
            modalStore.close(); // Close the modal after confirmation
        }
    }
</script>

<Popup title="Confirm Removal of Relay">
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
            <Button grow variant="outlined" on:click={() => modalStore.close()}>Cancel</Button>
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
</Popup>
