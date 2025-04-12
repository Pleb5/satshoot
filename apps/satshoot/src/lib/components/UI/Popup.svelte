<script lang="ts">
    import Card from './Card.svelte';
    import Button from './Buttons/Button.svelte';
    import QuestionIcon from '../Icons/QuestionIcon.svelte';

    interface Props {
        isOpen: boolean;
        title?: string; // Title for the modal header
        popUpText?: string | undefined;
        headerAction?: import('svelte').Snippet;
        children?: import('svelte').Snippet;
    }

    let {
        isOpen = $bindable(),
        title = '',
        popUpText = undefined,
        headerAction,
        children,
    }: Props = $props();

    function handleClose() {
        isOpen = false;
    }
</script>

<div
    class="fixed inset-0 z-90 bg-black-500 backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
>
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative">
        <div class="w-full flex flex-col justify-start items-center">
            <div class="w-full max-w-[500px] justify-start items-center">
                <Card>
                    <div
                        class="flex flex-row justify-between items-center gap-[10px] pb-[5px] border-b-[1px] border-b-black-100 dark:border-b-white-100"
                    >
                        <!-- slot for header action -->
                        {@render headerAction?.()}

                        <div class="flex flex-row items-center gap-[5px]">
                            <p class="font-[500] text-[18px]">{title}</p>
                            {#if popUpText}
                                <QuestionIcon
                                    extraClasses="text-[14px] p-[3px]"
                                    placement="bottom-start"
                                    {popUpText}
                                />
                            {/if}
                        </div>

                        <Button variant="outlined" onClick={handleClose}>
                            <i class="bx bx-x text-[20px]"></i>
                        </Button>
                    </div>
                    {@render children?.()}
                </Card>
            </div>
        </div>
    </div>
</div>
