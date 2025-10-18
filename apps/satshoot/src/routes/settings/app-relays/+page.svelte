<script lang="ts">
    import RelayRemovalConfirmation from '$lib/components/Modals/RelayRemovalConfirmation.svelte';
    import RelayListElement from '$lib/components/RelayListElement.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ndk, { DEFAULTRELAYURLS, getAppRelays } from '$lib/stores/session';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { APP_RELAY_STORAGE_KEY, normalizeRelayUrl } from '$lib/utils/misc';
    import { toaster } from '$lib/stores/toaster';
    import { onMount } from 'svelte';

    let showRelayRemovalConfirmation = $state(false);
    let relayToRemove = $state<string | null>(null);

    let appRelayUrls = $state<string[]>([]);
    let appRelayInputValue = $state('');

    let relaysLoaded = $state(false);

    async function addRelay(url?: string) {
        if (!url) {
            url = normalizeRelayUrl(appRelayInputValue);
        }

        if (!url) {
            toaster.warning({
                title: 'Invalid Relay URL',
                description: 'Please enter a valid relay URL starting with wss://',
            });
            return;
        }

        // Validate URL format
        if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
            toaster.error({
                title: 'Invalid Protocol',
                description: 'Relay URL must start with wss:// or ws://',
            });
            return;
        }

        if (appRelayUrls.includes(url)) {
            toaster.info({
                title: 'Relay Already Added',
                description: 'This relay is already in your list.',
            });
            appRelayInputValue = '';
            return;
        }

        try {
            // Add to the local list
            appRelayUrls = [...appRelayUrls, url];

            // Immediately add to NDK pool
            $ndk.addExplicitRelay(url, undefined, true);

            // Save to localStorage immediately
            localStorage.setItem(APP_RELAY_STORAGE_KEY, JSON.stringify(appRelayUrls));

            // Reconnect to ensure new relay is connected
            await checkRelayConnections();

            toaster.success({
                title: 'Relay Added',
                description: `${url} has been added and is connecting.`,
            });
        } catch (e) {
            console.error('Error adding relay:', e);
            toaster.error({
                title: 'Error Adding Relay',
                description: `Failed to add ${url}`,
            });
            // Rollback on error
            appRelayUrls = appRelayUrls.filter((r) => r !== url);
        }

        appRelayInputValue = '';
    }

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            addRelay();
        }
    }

    async function handleRelayRemoval(url: string) {
        try {
            // Remove from the local list
            appRelayUrls = appRelayUrls.filter((relayUrl) => relayUrl !== url);

            // Remove from NDK pool
            $ndk.pool.removeRelay(url);

            // Save to localStorage immediately
            localStorage.setItem(APP_RELAY_STORAGE_KEY, JSON.stringify(appRelayUrls));

            toaster.success({
                title: 'Relay Removed',
                description: `${url} has been disconnected and removed.`,
            });
        } catch (e) {
            console.error('Error removing relay:', e);
            toaster.error({
                title: 'Error Removing Relay',
                description: `Failed to remove ${url}`,
            });
        } finally {
            relayToRemove = null;
        }
    }

    function removeRelay(url: string) {
        relayToRemove = url;
        showRelayRemovalConfirmation = true;
    }

    onMount(() => {
        appRelayUrls = [...getAppRelays()];
        relaysLoaded = true;
        checkRelayConnections();
    });

    const suggestedRelayUrls = DEFAULTRELAYURLS;
    const filteredSuggestedAppRelays = $derived(
        suggestedRelayUrls.filter((relay) => !appRelayUrls.includes(relay))
    );
</script>

<div class="w-full flex flex-col gap-[15px] overflow-y-auto">
    {#if !relaysLoaded}
        <!-- Placeholder Section -->
        {#each { length: 4 } as _}
            <section class="w-full">
                <div class="p-4 space-y-4">
                    <div class="placeholder animate-pulse"></div>
                    <div class="grid grid-cols-3 gap-8">
                        <div class="placeholder animate-pulse"></div>
                        <div class="placeholder animate-pulse"></div>
                        <div class="placeholder animate-pulse"></div>
                    </div>
                    <div class="grid grid-cols-4 gap-4">
                        <div class="placeholder animate-pulse"></div>
                        <div class="placeholder animate-pulse"></div>
                        <div class="placeholder animate-pulse"></div>
                        <div class="placeholder animate-pulse"></div>
                    </div>
                </div>
            </section>
        {/each}
    {:else}
        <!-- App Relays Section -->
        <div class="w-full flex flex-col gap-[10px]">
            <p class="font-semibold">App Relays</p>
            <div class="flex flex-col gap-[5px]">
                <label class="m-[0px] text-[14px]" for="add-app-relay"> Add Relay </label>
                <div
                    class="flex flex-row rounded-[6px] overflow-hidden bg-white dark:bg-brightGray border-[2px] border-black-100 dark:border-white-100 gap-[2px]"
                >
                    <Input
                        type="text"
                        placeholder="wss://relay.example.com"
                        bind:value={appRelayInputValue}
                        onKeyPress={handleKeyPress}
                        fullWidth
                        noBorder
                        notRounded
                    />
                    <Button
                        onClick={addRelay}
                        disabled={!appRelayInputValue.trim()}
                        classes="bg-black-100 text-gray-500 rounded-[0px] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!appRelayInputValue.trim() ? 'Enter a relay URL first' : 'Add relay'}
                    >
                        <i class="bx bx-plus"></i>
                    </Button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
            >
                {#if appRelayUrls.length > 0}
                    {#each appRelayUrls as relayUrl (relayUrl)}
                        <RelayListElement {relayUrl} onRemove={() => removeRelay(relayUrl)} />
                    {/each}
                {:else}
                    <div
                        class="w-full min-h-[100px] rounded-[8px] bg-black-100 dark:bg-white-100 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center p-4 gap-2"
                    >
                        <i class="bx bx-broadcast text-4xl text-red-500"></i>
                        <p class="font-[600] text-[18px] text-red-500">No App Relays Selected!</p>
                        <p class="text-sm text-center opacity-70">
                            Add relays above or select from suggested relays below to connect to the
                            Nostr network.
                        </p>
                    </div>
                {/if}
            </div>

            {#if filteredSuggestedAppRelays.length}
                <p class="font-[500]">
                    <span class="font-[900]">Suggested</span>
                    App Relays
                </p>
                <div
                    class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                >
                    {#each filteredSuggestedAppRelays as relayUrl (relayUrl)}
                        <RelayListElement
                            {relayUrl}
                            onAdd={() => addRelay(relayUrl)}
                            isSuggestedRelay
                        />
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

{#if relayToRemove}
    <RelayRemovalConfirmation
        bind:isOpen={showRelayRemovalConfirmation}
        url={relayToRemove}
        onConfirm={async () => {
            handleRelayRemoval(relayToRemove!);
        }}
    />
{/if}
