<script lang="ts">
    import Card from './Card.svelte';
    import Button from './Buttons/Button.svelte';
    import QuestionIcon from '../Icons/QuestionIcon.svelte';
    import { onMount, onDestroy } from 'svelte';

    type PopupVariant = 'modal' | 'popover';

    interface Props {
        isOpen: boolean;
        title?: string; // Title for the modal header
        popUpText?: string | undefined;
        headerAction?: import('svelte').Snippet;
        children?: import('svelte').Snippet;
        variant?: PopupVariant;
        containerClasses?: string;
        cardClasses?: string;
    }

    let {
        isOpen = $bindable(),
        title = '',
        popUpText = undefined,
        headerAction,
        children,
        variant = 'modal',
        containerClasses = '',
        cardClasses = '',
    }: Props = $props();

    const containerBaseClasses = $derived(
        variant === 'modal'
            ? 'fixed inset-0 z-90 bg-black-500 backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto'
            : 'absolute z-90 right-0 top-full mt-[10px]'
    );

    // Reference to modal content container for click-outside detection
    let modalRef: HTMLDivElement;

    function handleClose() {
        isOpen = false;
    }

    // Handle clicks outside modal content
    function handleClickOutside(event: MouseEvent) {
        // Only close if click is outside modal content and modal is open
        if (modalRef && !modalRef.contains(event.target as Node) && isOpen) {
            handleClose();
        }
    }

    // Handle keyboard events
    function handleKeyDown(event: KeyboardEvent) {
        // Close on Escape key if modal is open
        if (event.key === 'Escape' && isOpen) {
            handleClose();
        }
    }

    // Set up event listeners when component mounts
    onMount(() => {
        document.addEventListener('click', handleClickOutside, true);
        document.addEventListener('keydown', handleKeyDown);
    });

    // Clean up event listeners when component unmounts
    onDestroy(() => {
        document.removeEventListener('click', handleClickOutside, true);
        document.removeEventListener('keydown', handleKeyDown);
    });
</script>

{#if isOpen}
    <div class="{containerBaseClasses} {containerClasses}">
        <div
            class={variant === 'modal'
                ? 'max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative'
                : 'w-full'}
        >
            <div class={variant === 'modal' ? 'w-full flex flex-col justify-start items-center' : ''}>
                <div
                    class={variant === 'modal'
                        ? 'w-full max-w-[500px] justify-start items-center'
                        : 'w-full'}
                    bind:this={modalRef}
                >
                    <Card classes={cardClasses}>
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
{/if}
