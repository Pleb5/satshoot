<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Card from './Card.svelte';
    import Button from './Buttons/Button.svelte';
    import QuestionIcon from '../Icons/QuestionIcon.svelte';

    const modalStore = getModalStore();

    export let title: string = ''; // Title for the modal header
    export let popUpText: string | undefined = undefined;

    function handleClose() {
        modalStore.close();
    }
</script>

<div
    class="fixed inset-[0] z-[90] bg-black-500 backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
>
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative">
        <div class="w-full flex flex-col justify-start items-center">
            <div class="w-full max-w-[500px] justify-start items-center">
                <Card>
                    <div
                        class="flex flex-row justify-between items-center gap-[10px] pb-[5px] border-b-[1px] border-b-black-100 dark:border-b-white-100"
                    >
                        <!-- slot for header action -->
                        <slot name="headerAction" />

                        <div class="flex flex-row items-center gap-[5px]">
                            <p class="font-[500] text-[18px]">{title}</p>
                            {#if popUpText}
                                <QuestionIcon
                                    extraClasses="text-[14px] p-[3px]"
                                    triggerEvent="click"
                                    placement="bottom-start"
                                    {popUpText}
                                />
                            {/if}
                        </div>

                        <Button variant="outlined" on:click={handleClose}>
                            <i class="bx bx-x text-[20px]" />
                        </Button>
                    </div>
                    <slot />
                </Card>
            </div>
        </div>
    </div>
</div>
