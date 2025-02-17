<script lang="ts">
    export let id: string; // ID for the checkbox
    export let label: string; // Label text
    export let checked: boolean; // Bound value

    const checkboxInputClasses =
        'appearance-none h-[20px] w-[20px] border-[1px] border-black-300 ' +
        'rounded-[4px] checked:bg-blue-500 checked:border-transparent peer';
</script>

<div
    class="grow-[1] rounded-[6px] overflow-hidden border-[1px] border-black-100 dark:border-white-100 px-[10px] py-[5px]"
>
    <div class="flex flex-row gap-[10px] items-center">
        <div class="flex flex-row justify-center items-center relative">
            <input {id} type="checkbox" bind:checked class={checkboxInputClasses} />
        </div>
        <label for={id}>{label}</label>
    </div>
</div>
