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

    export let url: string; // Relay URL to remove
    export let onConfirm: () => Promise<void>; // Callback function to invoke on confirmation

    let posting = false;

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
    <div class="w-full flex flex-col">
        <div class="w-full py-[10px] px-[5px]">
            <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px]">
                <div
                    class="w-full py-[5px] px-[10px] rounded-[6px] bg-orange-500 border-[2px] border-black-100 flex flex-col justify-center items-center"
                >
                    <p class="font-[600] text-[16px] text-white-700">
                        Do you really want to remove {url.replace('wss://', '').slice(0, -1)}?
                    </p>
                </div>

                <div class="flex flex-row gap-[5px]">
                    <Button grow variant="outlined" on:click={() => modalStore.close()}>
                        Abort
                    </Button>
                    <Button grow on:click={handleConfirm} disabled={posting}>
                        <i class="bx bx-trash" />
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
        </div>
    </div>
</Popup>
