<script lang="ts">
    import {
        getModalStore,
        getToastStore,
        ProgressRadial,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    interface Props {
        mint: string; // URL of Mint to remove
        onConfirm: () => Promise<void>; // Callback function to invoke on confirmation
    }

    let { mint, onConfirm }: Props = $props();

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

<Popup title="Confirm Removal of Mint">
    <div class="w-full flex flex-col gap-[15px]">
        <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px] mt-[10px]">
            <div
                class="w-full py-[5px] px-[10px] rounded-[6px] border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
            >
                <p class="font-[600] text-xl text-white">
                    <span>Do you really want to remove </span>
                    <span class="text-xl text-red-500">{mint.replace('https://', '')}</span>
                    <span>?<span></span>
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
                    <ProgressRadial
                        value={undefined}
                        stroke={60}
                        meter="stroke-white-500"
                        track="stroke-white-500/30"
                        strokeLinecap="round"
                        width="w-8"
                    />
                {/if}
            </Button>
        </div>
    </div>
</Popup>
