<script lang="ts">
    export let label: string;
    export let rating: string;
    export let iconClass: string = 'bx bxs-star';
    export let hoverEffect: boolean = false;
    export let color: string = '';
</script>

<p class="w-full text-start font-[600] pl-[5px]">{label}</p>
<div
    class="w-full flex flex-row justify-center items-center gap-[5px] p-[5px] rounded-[4px] bg-black-100 border-[1px] border-black-100 dark:border-white-100 text-black-500 dark:text-white {color} {hoverEffect
        ? 'group-hover:text-white'
        : ''}"
>
    <i class="{iconClass} pr-[5px] border-r-[1px] border-r-black-100" />
    <p class="font-[700] grow-[1] pl-[5px]">{rating}</p>
    {#if hoverEffect}
        <div
            class="transition ease duration-[0.3s] pl-[10px] pr-[5px] border-l-[1px] border-black-100 dark:border-white-100"
        >
            <i class="bx bxs-show" />
        </div>
    {/if}
</div>
