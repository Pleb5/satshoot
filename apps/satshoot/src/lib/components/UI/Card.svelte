<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';

    interface Props {
        classes?: string;
        actAsButton?: boolean;
        children?: import('svelte').Snippet;
        onClick?: () => void;
    }

    let { classes = '', actAsButton = false, children, onClick = () => {} }: Props = $props();

    const defaultClasses =
        'w-full flex flex-col gap-[5px] rounded-[8px] p-[15px] ' +
        'shadow-subtle bg-white dark:bg-brightGray';

    // Merge defaultClasses and classes, ensuring classes take precedence
    let finalClasses = $derived(mergeClasses(defaultClasses, classes));

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); // Prevent scrolling on space
            event.currentTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    }

    function forwardClick() {
        onClick();
    }
</script>

{#if actAsButton}
    <div
        class={finalClasses}
        role="button"
        tabindex={0}
        onclick={forwardClick}
        onkeydown={handleKeyDown}
    >
        {@render children?.()}
    </div>
{:else}
    <div class={finalClasses}>
        {@render children?.()}
    </div>
{/if}
