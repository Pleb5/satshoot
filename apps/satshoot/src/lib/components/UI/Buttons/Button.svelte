<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';
    import { createEventDispatcher } from 'svelte';
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
        'bg-[rgb(59,115,246)] text-white hover:bg-blue-500 hover:text-white whitespace-nowrap';

    const outlinedClasses =
        'text-[rgb(0,0,0,0.5)] border-[1px] border-[rgb(0,0,0,0.1)] ' +
        'hover:text-white hover:bg-[rgb(59,115,246)] hover:border-[rgb(0,0,0,0.0)]';

    const textClasses =
        'border-[0px] text-[rgb(0,0,0,0.5)] hover:text-white hover:bg-[rgb(59,115,246)]';

    $: variantClasses =
        variant === 'contained'
            ? containedClasses
            : variant === 'outlined'
              ? outlinedClasses
              : textClasses;

    $: growClasses = grow ? 'grow-[1]' : ''; // Add grow-[1] if grow is true

    $: fullWidthClasses = fullWidth ? 'w-full' : ''; // Add w-full if fullWidth is true

    $: combinedClasses = `${baseClasses} ${variantClasses} ${growClasses} ${fullWidthClasses} ${isToggle && selected ? 'bg-[rgb(59,115,246)] text-white' : ''}`;

    $: finalClasses = mergeClasses(combinedClasses, classes);
</script>

{#if href}
    <!-- Render anchor tag if href is provided -->
    <a {href} {target} {title} class={finalClasses} on:click={() => dispatch('click')}>
        <slot />
    </a>
{:else}
    <!-- Render button tag otherwise -->
    <button {title} {disabled} class={finalClasses} on:click={() => dispatch('click')}>
        <slot />
    </button>
{/if}
