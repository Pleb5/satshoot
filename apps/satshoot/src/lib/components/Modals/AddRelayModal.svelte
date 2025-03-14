<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Popup from '../UI/Popup.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import { normalizeRelayUrl } from '@nostr-dev-kit/ndk';

    const modalStore = getModalStore();

    let value = 'wss://';

    function finish() {
        if ($modalStore[0].response) {
            $modalStore[0].response(normalizeRelayUrl(value));
            modalStore.close();
        }
    }
</script>

{#if $modalStore[0]}
    <Popup title="Add New Relay">
        <div class="flex flex-col gap-[15px] mt-4">
            <Input bind:value />
            <Button on:click={finish}>Add Relay</Button>
        </div>
    </Popup>
{/if}
