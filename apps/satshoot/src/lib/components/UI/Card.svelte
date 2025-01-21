<script lang="ts">
    import { mergeClasses } from '$lib/utils/styles';

    export let classes = '';

    const defaultClasses =
        'w-full flex flex-col gap-[5px] rounded-[8px] p-[15px] ' +
        'shadow-[0_0_4px_0_rgba(0,0,0,0.1)] bg-white';

    // Merge defaultClasses and classes, ensuring classes take precedence
    $: finalClasses = mergeClasses(defaultClasses, classes);
</script>

<div class={finalClasses}>
    <slot></slot>
</div>
