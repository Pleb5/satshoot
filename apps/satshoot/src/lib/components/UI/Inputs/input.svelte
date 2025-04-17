<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';
    import type { HTMLInputTypeAttribute } from 'svelte/elements';

    interface Props {
        id?: string | null;
        step?: string | number | null | undefined;
        min?: string | number | null | undefined;
        max?: string | number | null | undefined;
        type?: HTMLInputTypeAttribute;
        value: any;
        placeholder?: string;
        classes?: string;
        grow?: boolean;
        fullWidth?: boolean;
        disabled?: boolean;
        readonly?: boolean;
        noBorder?: boolean;
        notRounded?: boolean;
        textarea?: boolean;
        rows?: number | undefined | null;
        minlength?: number | undefined | null;
        onKeyPress?: (event: KeyboardEvent) => void; // Default is a no-op
    }

    let {
        id = null,
        step = null,
        min = null,
        max = null,
        type = 'text',
        value = $bindable(),
        placeholder = '',
        classes = '',
        grow = false,
        fullWidth = false,
        disabled = false,
        readonly = false,
        noBorder = false,
        notRounded = false,
        textarea = false,
        rows = null,
        minlength = null,
        onKeyPress = () => {},
    }: Props = $props();

    const baseClasses =
        'transition ease duration-[0.3s] px-[10px] py-[5px] bg-black-50 focus:bg-black-100 ' +
        'outline-[0px] focus:outline-[0px] ';

    // Conditional classes for border and rounded corners
    let borderClasses = $derived(
        noBorder
            ? 'border-[0px]'
            : 'border-[2px] border-black-100 dark:border-white-100 focus:border-blue-500'
    );
    let roundedClasses = $derived(notRounded ? 'rounded-[0px]' : 'rounded-[6px]');
    let growClasses = $derived(grow ? 'grow-1' : '');
    let fullWidthClasses = $derived(fullWidth ? 'w-full' : '');

    let combinedClasses = $derived(
        `${baseClasses} ${borderClasses} ${roundedClasses} ${growClasses} ${fullWidthClasses}`
    );
    let finalClasses = $derived(mergeClasses(combinedClasses, classes));

    // Element reference
    let inputElement = $state<HTMLInputElement | HTMLTextAreaElement>();

    // Effect to handle input type changes
    $effect(() => {
        if (inputElement && !textarea && inputElement instanceof HTMLInputElement) {
            inputElement.type = type;
        }
    });
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
        bind:this={inputElement}
    ></textarea>
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
        onkeydown={onKeyPress}
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
        onkeydown={onKeyPress}
    />
{/if}
