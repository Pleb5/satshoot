<script lang="ts">
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

    const toggleBtnClasses =
        'transition-all ease duration-[0.3s] py-[5px] px-[10px] rounded-[4px] grow-[1] ' +
        'text-center text-[rgb(0,0,0,0.5)] cursor-pointer hover:text-white hover:bg-[#3b73f6]';
</script>

<div class="w-full flex flex-col gap-[5px]">
    <div class="w-full max-h-[50vh] overflow-auto">
        <p class="w-full">{question}</p>
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[10px] rounded-[6px] bg-[rgb(0,0,0,0.1)] p-[5px] border-[1px] border-[rgb(0,0,0,0.1)]"
    >
        <button
            class={toggleBtnClasses}
            class:bg-[#3b73f6]={value}
            class:text-white={value}
            on:click={handleOptionTrueClick}
        >
            {trueLabel}
        </button>
        <button
            class={toggleBtnClasses}
            class:bg-[#3b73f6]={!value}
            class:text-white={!value}
            on:click={handleOptionFalseClick}
        >
            {falseLabel}
        </button>
    </div>
</div>
