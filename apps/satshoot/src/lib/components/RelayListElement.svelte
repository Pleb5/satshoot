<script lang="ts">
    import { NDKRelayStatus } from '@nostr-dev-kit/ndk';
    import Button from './UI/Buttons/Button.svelte';
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { normalizeRelayUrl } from '$lib/utils/misc';

    const dispatch = createEventDispatcher();

    interface Props {
        relayUrl: string;
        isSuggestedRelay?: boolean;
    }

    let { relayUrl, isSuggestedRelay = false }: Props = $props();

    let relayStatusColor = $state('');
    let relayStatusText = $state('');
    let relayElement: HTMLDivElement | null = $state(null);

    function handleClick(event: MouseEvent) {
        if (isSuggestedRelay && !(event.target as HTMLElement).closest('button')) {
            dispatch('add');
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (isSuggestedRelay && (event.key === 'Enter' || event.key === ' ')) {
            dispatch('add');
        }
    }

    onMount(() => {
        if (relayElement) {
            relayElement.addEventListener('click', handleClick);
            relayElement.addEventListener('keydown', handleKeydown);
        }

        const ndkPool = $ndk.pool;

        const relay = ndkPool.getRelay(relayUrl, true);

        relay.on('connect', () => {
            console.log('relay connected:>> ', relay);
        });

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

        ndkPool.on('relay:connecting', (relay) => {
            if (normalizeRelayUrl(relay.url) === normalizeRelayUrl(relayUrl)) {
                relayStatusColor = 'bg-warning-500';
                relayStatusText = 'Connecting';
            }
        });

        ndkPool.on('relay:disconnect', (relay) => {
            if (normalizeRelayUrl(relay.url) === normalizeRelayUrl(relayUrl)) {
                relayStatusColor = 'bg-error-500';
                relayStatusText = 'Disconnected';
            }
        });

        ndkPool.on('relay:connect', (relay) => {
            if (normalizeRelayUrl(relay.url) === normalizeRelayUrl(relayUrl)) {
                relayStatusColor = 'bg-success-600';
                relayStatusText = 'Connected';
            }
        });

        ndkPool.on('flapping', (relay) => {
            if (normalizeRelayUrl(relay.url) === normalizeRelayUrl(relayUrl)) {
                relayStatusColor = 'bg-warning-500';
                relayStatusText = 'Flapping';
            }
        });

        ndkPool.on('relay:auth', (relay) => {
            if (normalizeRelayUrl(relay.url) === normalizeRelayUrl(relayUrl)) {
                relayStatusColor = 'bg-primary-500';
                relayStatusText = 'Authenticating';
            }
        });
    });

    onDestroy(() => {
        if (relayElement) {
            relayElement.removeEventListener('click', handleClick);
            relayElement.removeEventListener('keydown', handleKeydown);
        }
    });

    const itemWrapperClasses =
        'transition ease duration-[0.3s] w-full flex flex-row gap-[10px] justify-between items-center rounded-[6px] ' +
        'bg-black-100 overflow-hidden max-[576px]:gap-[0px] max-[576px]:flex-col hover:bg-blue-500 group ' +
        (isSuggestedRelay ? 'cursor-pointer' : '');
</script>

<!-- Clickable & Keyboard-accessible Wrapper -->
<div
    bind:this={relayElement}
    class={itemWrapperClasses}
    role={isSuggestedRelay ? 'button' : undefined}
    aria-label={isSuggestedRelay ? 'Add relay' : undefined}
>
    <div
        class="flex flex-row gap-[5px] justify-center items-center p-[10px] bg-black-200 border-r-[1px] border-black-100 dark:border-white-100 max-[576px]:w-full"
    >
        <div
            title={relayStatusText}
            class="h-[15px] w-[15px] rounded-[4px] {relayStatusColor}"
        ></div>
        <p class="max-[576px]:block hidden">{relayStatusText}</p>
    </div>
    <p
        class="transition ease duration-[0.3s] grow-[1] group-hover:text-white break-all max-[576px]:py-[5px]"
    >
        {relayUrl}
    </p>

    {#if isSuggestedRelay}
        <Button
            on:click={() => dispatch('add')}
            variant="text"
            classes="min-h-[35px] rounded-[0px] hover:bg-green-600 hover:text-white"
        >
            <i class="bx bx-plus"></i>
            Add
        </Button>
    {:else}
        <Button
            on:click={() => dispatch('remove')}
            variant="text"
            classes="min-h-[35px] rounded-[0px] hover:bg-red-500 hover:text-white"
        >
            <i class="bx bxs-trash"></i>
        </Button>
    {/if}
</div>
