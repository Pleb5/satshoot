<script lang="ts">
    import Input from '../UI/Inputs/input.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { normalizeRelayUrl } from '@nostr-dev-kit/ndk';

    interface Props {
        isOpen: boolean;
        callback: (value: string) => void;
    }

    let { isOpen = $bindable(), callback }: Props = $props();

    let value = $state('wss://');

    function finish() {
        callback(normalizeRelayUrl(value));
        isOpen = false;
    }
</script>

<ModalWrapper bind:isOpen title="Add New Relay">
    <div class="flex flex-col gap-[15px] mt-4">
        <Input bind:value />
        <Button on:click={finish}>Add Relay</Button>
    </div>
</ModalWrapper>
