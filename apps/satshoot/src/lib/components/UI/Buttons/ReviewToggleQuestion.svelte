<script lang="ts">
    import Button from './Button.svelte';

    export let question: string;
    export let value: boolean;
    export let trueLabel: string;
    export let falseLabel: string;

    const handleOptionTrueClick = () => {
        value = true;
    };

    const handleOptionFalseClick = () => {
        value = false;
    };
</script>

<div class="w-full flex flex-col gap-[5px]">
    <div class="w-full max-h-[50vh] overflow-auto">
        <p class="w-full">{question}</p>
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[10px] rounded-[6px] bg-black-100 p-[5px] border-[1px] border-black-100 dark:border-white-100"
    >
        <Button variant="text" selected={value} grow isToggle on:click={handleOptionTrueClick}>
            {trueLabel}
        </Button>
        <Button variant="text" selected={!value} grow isToggle on:click={handleOptionFalseClick}>
            {falseLabel}
        </Button>
    </div>
</div>
