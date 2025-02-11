<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';

    export let classes = '';
    export let actAsButton = false;

    const defaultClasses =
        'w-full flex flex-col gap-[5px] rounded-[8px] p-[15px] ' + 'shadow-subtle bg-white';

    // Merge defaultClasses and classes, ensuring classes take precedence
    $: finalClasses = mergeClasses(defaultClasses, classes);

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); // Prevent scrolling on space
            event.currentTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    }
</script>

{#if actAsButton}
    <div class={finalClasses} role="button" tabindex={0} on:click on:keydown={handleKeyDown}>
        <slot></slot>
    </div>
{:else}
    <div class={finalClasses}>
        <slot></slot>
    </div>
{/if}
