<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Popup from '../UI/Popup.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const modalStore = getModalStore();

    export let dataToEdit: string;

    $: value = dataToEdit;

    function update() {
        if ($modalStore[0].response) {
            $modalStore[0].response(value);
            modalStore.close();
        }
    }
</script>

{#if $modalStore[0]}
    <Popup title="Update Ecash Wallet Name">
        <div class="flex flex-col gap-[15px] mt-4">
            <Input bind:value />
            <Button on:click={update}>Update</Button>
        </div>
    </Popup>
{/if}
