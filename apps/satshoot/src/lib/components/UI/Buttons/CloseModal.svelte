<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Button from './Button.svelte';

    const modalStore = getModalStore();

    function handleClose() {
        modalStore.close();
    }
</script>

<Button variant="outlined" on:click={handleClose}>
    <i class="bx bx-x text-[20px]" />
</Button>
