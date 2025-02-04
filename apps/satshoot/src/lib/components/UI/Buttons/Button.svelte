<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';
    import { createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import type { HTMLAttributeAnchorTarget } from 'svelte/elements';

    type Variant = 'contained' | 'outlined' | 'text';

    export let variant: Variant = 'contained';
    export let classes = '';
    export let href: string | null = null;
    export let target: HTMLAttributeAnchorTarget | null = null;
    export let disabled = false;
    export let isToggle = false;
    export let selected = false;
    export let grow = false;
    export let fullWidth = false;
    export let title: string | null = null;

    const dispatch = createEventDispatcher();

    const baseClasses =
        'transition-all ease duration-[0.3s] p-[10px_20px] rounded-[5px] ' +
        'flex flex-row justify-center items-center gap-[10px] font-[600] ' +
        'cursor-pointer disabled:cursor-not-allowed';

    const containedClasses =
        'bg-blue-500 text-white hover:bg-blue-600 hover:text-white whitespace-nowrap ' +
        'disabled:bg-gray-400 disabled:hover:bg-gray-400'; // Disabled state styles

    const outlinedClasses =
        'text-black-500 border-[1px] border-black-100 ' +
        'hover:text-white hover:bg-blue-500 hover:border-transparent ' +
        'disabled:bg-gray-200 disabled:hover:bg-gray-200 disabled:text-gray-500'; // Disabled state styles

    const textClasses =
        'border-[0px] text-black-500 hover:text-white hover:bg-blue-500 ' +
        'disabled:bg-transparent disabled:text-gray-400'; // Disabled state styles

    $: variantClasses =
        variant === 'contained'
            ? containedClasses
            : variant === 'outlined'
              ? outlinedClasses
              : textClasses;

    $: growClasses = grow ? 'grow-[1]' : ''; // Add grow-[1] if grow is true

    $: fullWidthClasses = fullWidth ? 'w-full' : ''; // Add w-full if fullWidth is true

    $: combinedClasses = `${baseClasses} ${variantClasses} ${growClasses} ${fullWidthClasses} ${isToggle && selected ? 'bg-blue-500 text-white' : ''}`;

    $: finalClasses = mergeClasses(combinedClasses, classes);

    // Determine if the link is external
    $: isExternal = href && /^https?:\/\//.test(href);

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
    <a {href} {title} class={finalClasses} {target} on:click={handleClick}>
        <slot />
    </a>
{:else}
    <!-- Render button tag otherwise -->
    <button {title} {disabled} class={finalClasses} on:click={handleClick}>
        <slot />
    </button>
{/if}
