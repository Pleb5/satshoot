<script lang="ts">
    export let id: string; // ID for the checkbox
    export let label: string; // Label text
    export let checked: boolean; // Bound value

    const checkboxInputClasses =
        'appearance-none h-[20px] w-[20px] border-[1px] border-[rgb(0,0,0,0.25)] ' +
        'rounded-[4px] checked:bg-blue-500 checked:border-[rgb(0,0,0,0.0)] peer';
</script>

<div
    class="w-full rounded-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.1)] px-[10px] py-[5px]"
>
    <div class="flex flex-row gap-[10px] items-center">
        <div class="flex flex-row justify-center items-center relative">
            <input {id} type="checkbox" bind:checked class={checkboxInputClasses} />
        </div>
        <label for={id}>{label}</label>
    </div>
</div>
