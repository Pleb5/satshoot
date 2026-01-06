<script lang="ts">
    import { toaster } from '$lib/stores/toaster';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import Button from '../UI/Buttons/Button.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        payeePubkey: string;
        amount: number;
        onConfirm: () => Promise<void>; // Callback function to invoke on confirmation
    }

    let {
        isOpen = $bindable(),
        payeePubkey = $bindable(),
        amount = $bindable(),
        onConfirm = $bindable(),
    }: Props = $props();

    async function handleConfirm() {
        try {
            isOpen = false;
            await onConfirm(); // Invoke the parent's callback function
        } catch (e) {
            toaster.error({
                title: 'Error: ' + e,
            });
        }
    }
</script>

<ModalWrapper bind:isOpen title="Confirm Payment">
    <div class="w-full flex flex-col gap-[15px]">
        <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px] mt-[10px]">
            <div
                class="w-full py-[5px] px-[10px] rounded-[6px] border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
            >
                <p class="lg:text-[28px] text-[22px]">
                    You are about to pay
                    <span class="font-bold">{insertThousandSeparator(amount)} sats </span> to
                    {#if payeePubkey}
                        <UserProfile pubkey={payeePubkey} showLNAddress={true}/>
                    {/if}
                </p>
            </div>
        </div>

        <div class="w-full flex items-center justify-center gap-[10px]">
            <Button grow variant="outlined" onClick={() => (isOpen = false)}>Cancel</Button>
            <Button grow onClick={handleConfirm}>Confirm</Button>
        </div>
    </div>
</ModalWrapper>
