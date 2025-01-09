<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();

    function handleClose() {
        modalStore.close();
    }

    const closeBtnClasses =
        'transition-all ease duration-[0.3s] py-[5px] px-[10px] rounded-[4px] text-[rgb(0,0,0,0.5)] ' +
        'border-[1px] border-[rgb(0,0,0,0.1)] hover:border-[rgb(0,0,0,0.0)] hover:text-white hover:bg-[#3b73f6]';
</script>

<button class={closeBtnClasses} on:click={handleClose}>
    <i class="bx bx-x text-[20px]" />
</button>
