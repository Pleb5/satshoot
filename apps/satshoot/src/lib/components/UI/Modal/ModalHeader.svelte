<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Button from '../Buttons/Button.svelte';

    const modalStore = getModalStore();

    export let title: string;

    function handleClose() {
        modalStore.close();
    }
</script>

<div
    class="flex flex-row justify-between items-center gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
>
    <p class="font-[500] text-[18px]">{title}</p>

    <Button variant="outlined" on:click={handleClose}>
        <i class="bx bx-x text-[20px]" />
    </Button>
</div>
