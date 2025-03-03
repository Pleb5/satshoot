<script lang="ts">
    import type { NDKRelay } from '@nostr-dev-kit/ndk';
    import { NDKRelayStatus } from '@nostr-dev-kit/ndk';
    import Button from './UI/Buttons/Button.svelte';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let relay: NDKRelay;
    export let isSuggestedRelay = false;
    let relayStatusColor: string;
    let relayStatusText: string;

    $: if (relay && relay.status) {
        if (
            relay.status == NDKRelayStatus.CONNECTING ||
            relay.status === NDKRelayStatus.RECONNECTING
        ) {
            relayStatusColor = 'bg-warning-500';
            relayStatusText = 'Connecting';
        } else if (relay.status == NDKRelayStatus.DISCONNECTED) {
            relayStatusColor = 'bg-error-500';
            relayStatusText = 'Disconnected';
        } else if (relay.status == NDKRelayStatus.CONNECTED) {
            relayStatusColor = 'bg-success-600';
            relayStatusText = 'Connected';
        } else if (relay.status == NDKRelayStatus.FLAPPING) {
            relayStatusColor = 'bg-warning-500';
            relayStatusText = 'Flapping';
        } else if (relay.status === NDKRelayStatus.AUTHENTICATING) {
            relayStatusColor = 'bg-primary-500';
            relayStatusText = 'Authenticating';
        }
    }

    const itemWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row gap-[10px] justify-between items-center rounded-[6px] ' +
        'bg-black-100 overflow-hidden max-[576px]:gap-[0px] max-[576px]:flex-col hover:bg-blue-500 group';
</script>

<div class={itemWrapperClasses}>
    <div
        class="flex flex-row justify-center items-center p-[10px] bg-black-200 border-r-[1px] border-black-100 dark:border-white-100 max-[576px]:w-full"
    >
        <div
            title={relayStatusText}
            class="h-[15px] w-[15px] rounded-[4px] max-[576px]:w-full {relayStatusColor}"
        ></div>
    </div>
    <p
        class="transition ease duration-[0.3s] grow-[1] group-hover:text-white break-all max-[576px]:py-[5px]"
    >
        {relay.url}
    </p>

    {#if isSuggestedRelay}
        <Button
            on:click={() => dispatch('add')}
            variant="text"
            classes="min-h-[35px] rounded-[0px] hover:bg-green-600 hover:text-white"
        >
            <i class="bx bx-plus" />
        </Button>
    {:else}
        <Button
            on:click={() => dispatch('remove')}
            variant="text"
            classes="min-h-[35px] rounded-[0px] hover:bg-red-500 hover:text-white"
        >
            <i class="bx bxs-trash" />
        </Button>
    {/if}
</div>
