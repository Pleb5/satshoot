<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';
    import { createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import type { HTMLAttributeAnchorTarget } from 'svelte/elements';

    type Variant = 'contained' | 'outlined' | 'text';

    interface Props {
        variant?: Variant;
        classes?: string;
        href?: string | null;
        target?: HTMLAttributeAnchorTarget | null;
        disabled?: boolean;
        isToggle?: boolean;
        selected?: boolean;
        grow?: boolean;
        fullWidth?: boolean;
        title?: string | null;
        children?: import('svelte').Snippet;
    }

    let {
        variant = 'contained',
        classes = '',
        href = null,
        target = null,
        disabled = false,
        isToggle = false,
        selected = false,
        grow = false,
        fullWidth = false,
        title = null,
        children
    }: Props = $props();

    const dispatch = createEventDispatcher();

    const baseClasses =
        'transition-all ease duration-[0.3s] p-[6px_15px] rounded-[6px] ' +
        'flex flex-row justify-center items-center gap-[10px] font-[600] ' +
        'cursor-pointer disabled:cursor-not-allowed';

    const containedClasses =
        'bg-blue-500 text-white dark:text-white hover:bg-blue-600 hover:text-white whitespace-nowrap ' +
        'disabled:bg-gray-400 disabled:hover:bg-gray-400'; // Disabled state styles

    const outlinedClasses =
        'text-black-500 dark:text-white ' +
        'outline outline-[1px] outline-black-100 dark:outline-white-100 ' +
        'hover:text-white hover:bg-blue-500 hover:border-transparent ' +
        'disabled:bg-gray-200 disabled:hover:bg-gray-200 disabled:text-gray-500'; // Disabled state styles

    const textClasses =
        'border-[0px] text-black-500 dark:text-white hover:text-white hover:bg-blue-500 ' +
        'disabled:bg-transparent disabled:text-gray-400'; // Disabled state styles

    let variantClasses =
        $derived(variant === 'contained'
            ? containedClasses
            : variant === 'outlined'
              ? outlinedClasses
              : textClasses);

    let growClasses = $derived(grow ? 'grow-[1]' : ''); // Add grow-[1] if grow is true

    let fullWidthClasses = $derived(fullWidth ? 'w-full' : ''); // Add w-full if fullWidth is true

    let combinedClasses = $derived(`${baseClasses} ${variantClasses} ${growClasses} ${fullWidthClasses} ${isToggle && selected ? 'bg-blue-500 text-white' : ''}`);

    let finalClasses = $derived(mergeClasses(combinedClasses, classes));

    // Determine if the link is external
    let isExternal = $derived(href && /^https?:\/\//.test(href));

    // Handle click for internal links
    function handleClick(event: MouseEvent) {
        if (href && !isExternal && !target) {
            event.preventDefault(); // Prevent default anchor behavior
            goto(href); // Use SvelteKit's client-side navigation
        }
        dispatch('click'); // Emit the click event
    }
</script>

{#if href}
    <!-- Render anchor tag if href is provided -->
    <a {href} {title} class={finalClasses} {target} onclick={handleClick}>
        {@render children?.()}
    </a>
{:else}
    <!-- Render button tag otherwise -->
    <button {title} {disabled} class={finalClasses} onclick={handleClick}>
        {@render children?.()}
    </button>
{/if}
