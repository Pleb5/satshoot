<script lang="ts">
    import Button from './Button.svelte';

    interface Props {
        question: string;
        value: boolean;
        trueLabel: string;
        falseLabel: string;
    }

    let { question, value = $bindable(), trueLabel, falseLabel }: Props = $props();

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
        <Button variant="text" selected={value} grow isToggle onClick={handleOptionTrueClick}>
            {trueLabel}
        </Button>
        <Button variant="text" selected={!value} grow isToggle onClick={handleOptionFalseClick}>
            {falseLabel}
        </Button>
    </div>
</div>
