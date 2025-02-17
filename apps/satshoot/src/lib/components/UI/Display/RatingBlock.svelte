<script lang="ts">
    export let label: string;
    export let rating: string;
    export let iconClass: string = 'bx bxs-star';
    export let hoverEffect: boolean = false;
</script>

<p class="w-full text-start font-[600] pl-[5px]">{label}</p>
<div
    class="w-full flex flex-row justify-center items-center gap-[5px] p-[5px] rounded-[4px] bg-black-100 border-[1px] border-black-100 dark:border-white-100"
>
    <i
        class="{iconClass} border-r-[1px] border-r-black-100 text-black-500 dark:text-white-500 pr-[5px] {hoverEffect
            ? 'group-hover:text-white'
            : ''}"
    />
    <p class="font-[700] grow-[1]">{rating}</p>
</div>
