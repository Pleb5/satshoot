<script lang="ts">
    import Popup from '../UI/Popup.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();
</script>

<ModalWrapper bind:isOpen title="You accepted the Offer!">
    <strong class="text-error-500">
        It is strongly recommended you use specialized E2EE(e.g. SimpleX chat) messaging software
        for highly sensitive information!
    </strong>
    <p class="mt-4">
        <span> You will be redirected to </span>
        <span class="badge bg-primary-300-600">
            <span class="mr-2">Chat</span>
            <i class="fa-solid fa-comment text-lg md:text-xl"></i>
        </span>
        <span>
            and talk about your preferred communication method then switch to that app for the
            actual Job!
        </span>
    </p>

    <div class="flex justify-center">
        <Button
            on:click={() => {
                isOpen = false;
            }}
        >
            Great!
        </Button>
    </div>
</ModalWrapper>
