<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';
    import type { HTMLInputTypeAttribute } from 'svelte/elements';

    export let id: string | null = null;
    export let step: string | number | null | undefined = null;
    export let min: string | number | null | undefined = null;
    export let max: string | number | null | undefined = null;
    export let type: HTMLInputTypeAttribute = 'text';
    export let value: any;
    export let placeholder = '';
    export let classes = '';
    export let grow = false;
    export let fullWidth = false;
    export let disabled = false;
    export let readonly = false;
    export let noBorder = false;
    export let notRounded = false;

    export let textarea = false;
    export let rows: number | undefined | null = null;
    export let minlength: number | undefined | null = null;

    export let onKeyPress: (event: KeyboardEvent) => void = () => {}; // Default is a no-op

    const baseClasses =
        'transition ease duration-[0.3s] px-[10px] py-[5px] bg-black-50 focus:bg-black-100' +
        'outline outline-[0px] outline-blue-0 focus:outline focus:outline-[0px] focus:outline-blue-0';

    // Conditional classes for border and rounded corners
    $: borderClasses = noBorder
        ? 'border-[0px]'
        : 'border-[2px] border-black-100 dark:border-white-100 focus:border-blue-500';
    $: roundedClasses = notRounded ? 'rounded-[0px]' : 'rounded-[6px]';
    $: growClasses = grow ? 'grow-[1]' : '';
    $: fullWidthClasses = fullWidth ? 'w-full' : '';

    $: combinedClasses = `${baseClasses} ${borderClasses} ${roundedClasses} ${growClasses} ${fullWidthClasses}`;
    $: finalClasses = mergeClasses(combinedClasses, classes);

    let inputElement: HTMLInputElement;

    // Dynamically set the type of the input
    $: if (inputElement) {
        inputElement.type = type;
    }
</script>

{#if textarea}
    <textarea
        {id}
        {rows}
        {minlength}
        {placeholder}
        {disabled}
        {readonly}
        class={finalClasses}
        bind:value
    />
{:else if type === 'number'}
    <input
        {id}
        {step}
        {min}
        {max}
        {placeholder}
        {disabled}
        {readonly}
        type="number"
        class={finalClasses}
        bind:value
        bind:this={inputElement}
        on:keydown={onKeyPress}
    />
{:else}
    <input
        {id}
        {placeholder}
        {disabled}
        {readonly}
        class={finalClasses}
        bind:value
        bind:this={inputElement}
        on:keydown={onKeyPress}
    />
{/if}
