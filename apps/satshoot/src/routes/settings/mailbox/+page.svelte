<script lang="ts">
    import RelayListElement from '$lib/components/RelayListElement.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ndk, { DEFAULTRELAYURLS } from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import {
        broadcastRelayList,
        checkRelayConnections,
        fetchUserOutboxRelays,
    } from '$lib/utils/helpers';
    import { normalizeRelayUrl } from '$lib/utils/misc';
    import { NDKRelayList } from '@nostr-dev-kit/ndk';

    import { onMount } from 'svelte';
    import { connected, RelayType } from '$lib/stores/network';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';

    let needRelays = $state(true);
    let posting = $state(false);

    let readRelayUrls = $state<string[]>([]);
    let writeRelayUrls = $state<string[]>([]);

    let readRelayInputValue = $state('');
    let writeRelayInputValue = $state('');

    let relaysLoaded = $state(false);

    $effect(() => {
        if ($currentUser && $connected && needRelays) {
            needRelays = false;
            relaysLoaded = false;

            fetchOutboxRelays();
        }
    });

    async function fetchOutboxRelays() {
        const relays = await fetchUserOutboxRelays($ndk, $currentUser!.pubkey);

        if (relays) {
            const ndkRelayList = NDKRelayList.from(relays);

            readRelayUrls = [...new Set(ndkRelayList.readRelayUrls)];
            writeRelayUrls = [...new Set(ndkRelayList.writeRelayUrls)];
        }

        relaysLoaded = true;
    }

    async function addRelay(relayType: RelayType, url?: string) {
        if (!url) {
            url =
                relayType === RelayType.READ
                    ? normalizeRelayUrl(readRelayInputValue)
                    : normalizeRelayUrl(writeRelayInputValue);
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

        const relayTypeName = relayType === RelayType.READ ? 'Inbox' : 'Outbox';

        if (relayType === RelayType.READ) {
            if (readRelayUrls.includes(url)) {
                toaster.info({
                    title: 'Relay Already Added',
                    description: `This relay is already in your ${relayTypeName} list.`,
                });
                readRelayInputValue = '';
                return;
            }
            readRelayUrls = [...readRelayUrls, url];
            readRelayInputValue = '';
        } else {
            if (writeRelayUrls.includes(url)) {
                toaster.info({
                    title: 'Relay Already Added',
                    description: `This relay is already in your ${relayTypeName} list.`,
                });
                writeRelayInputValue = '';
                return;
            }
            writeRelayUrls = [...writeRelayUrls, url];
            writeRelayInputValue = '';
        }

        toaster.success({
            title: `${relayTypeName} Relay Added`,
            description: `${url} added. Click "Save & Broadcast" to publish changes.`,
        });
    }

    function handleKeyPress(relayType: RelayType) {
        return (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                addRelay(relayType);
            }
        };
    }

    function removeRelay(url: string, relayType: RelayType) {
        const relayTypeName = relayType === RelayType.READ ? 'Inbox' : 'Outbox';

        if (relayType === RelayType.READ) {
            readRelayUrls = readRelayUrls.filter((relayUrl) => relayUrl !== url);
        } else {
            writeRelayUrls = writeRelayUrls.filter((relayUrl) => relayUrl !== url);
        }

        toaster.success({
            title: `${relayTypeName} Relay Removed`,
            description: `${url} removed. Click "Save & Broadcast" to publish changes.`,
        });
    }

    async function updateRelays() {
        posting = true;

        try {
            await broadcastRelayList($ndk, Array.from(readRelayUrls), Array.from(writeRelayUrls));

            posting = false;

            toaster.success({
                title: 'New Relay Config Broadcasted!',
            });
        } catch (e) {
            toaster.error({
                title: 'Could not post Relays: ' + e,
            });

            fetchOutboxRelays();
        } finally {
            posting = false;
        }
    }

    onMount(() => {
        checkRelayConnections();
    });

    const suggestedRelayUrls = DEFAULTRELAYURLS;
    const filteredSuggestedInboxRelays = $derived(
        suggestedRelayUrls.filter((relay) => !readRelayUrls.includes(relay))
    );
    const filteredSuggestedOutboxRelays = $derived(
        suggestedRelayUrls.filter((relay) => !writeRelayUrls.includes(relay))
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
        <!-- Inbox Relays Section -->
        <div class="w-full flex flex-col gap-[10px]">
            <div class="w-full flex items-center gap-[5px]">
                <p class="font-semibold">Inbox Relays</p>
                <p class="font-thin text-sm">(used by other users to send notes to you)</p>
            </div>
            <div class="flex flex-col gap-[5px]">
                <label class="m-[0px] text-[14px]" for="add-inbox-relay"> Add Relay </label>
                <div
                    class="flex flex-row rounded-[6px] overflow-hidden bg-white dark:bg-brightGray border-[2px] border-black-100 dark:border-white-100 gap-[2px]"
                >
                    <Input
                        type="text"
                        placeholder="wss://relay.example.com"
                        bind:value={readRelayInputValue}
                        onKeyPress={handleKeyPress(RelayType.READ)}
                        fullWidth
                        noBorder
                        notRounded
                    />
                    <Button
                        onClick={() => addRelay(RelayType.READ)}
                        disabled={posting || !readRelayInputValue.trim()}
                        classes="bg-black-100 text-gray-500 rounded-[0px] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!readRelayInputValue.trim()
                            ? 'Enter a relay URL first'
                            : 'Add inbox relay'}
                    >
                        <i class="bx bx-plus"></i>
                    </Button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
            >
                {#if readRelayUrls.length > 0}
                    {#each readRelayUrls as relayUrl (relayUrl)}
                        <RelayListElement
                            {relayUrl}
                            onRemove={() => removeRelay(relayUrl, RelayType.READ)}
                        />
                    {/each}
                {:else}
                    <div
                        class="w-full min-h-[100px] rounded-[8px] bg-black-100 dark:bg-white-100 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center p-4 gap-2"
                    >
                        <i class="bx bx-inbox text-4xl text-red-500"></i>
                        <p class="font-[600] text-[18px] text-red-500">No Inbox Relays Selected!</p>
                        <p class="text-sm text-center opacity-70">
                            Add relays above or select from suggested relays below for others to
                            reach you.
                        </p>
                    </div>
                {/if}
            </div>

            {#if filteredSuggestedInboxRelays.length}
                <p class="font-[500]">
                    <span class="font-[900]">Suggested</span>
                    Inbox Relays
                </p>
                <div
                    class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                >
                    {#each filteredSuggestedInboxRelays as relayUrl (relayUrl)}
                        <RelayListElement
                            {relayUrl}
                            onAdd={() => addRelay(RelayType.READ, relayUrl)}
                            isSuggestedRelay
                        />
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Outbox Relays Section -->
        <div
            class="w-full flex flex-col gap-[10px] border-t-[1px] border-black-200 dark:border-white-200 pt-[10px] mt-[10px]"
        >
            <div class="w-full flex items-center gap-[5px]">
                <p class="font-semibold">Outbox Relays</p>
                <p class="font-thin text-sm">(used to publish all your notes and events)</p>
            </div>
            <div class="flex flex-col gap-[5px]">
                <label class="m-[0px] text-[14px]" for="add-inbox-relay"> Add Relay </label>
                <div
                    class="flex flex-row rounded-[6px] overflow-hidden bg-white dark:bg-brightGray border-[2px] border-black-100 dark:border-white-100 gap-[2px]"
                >
                    <Input
                        type="text"
                        placeholder="wss://relay.example.com"
                        bind:value={writeRelayInputValue}
                        onKeyPress={handleKeyPress(RelayType.WRITE)}
                        fullWidth
                        noBorder
                        notRounded
                    />
                    <Button
                        onClick={() => addRelay(RelayType.WRITE)}
                        disabled={posting || !writeRelayInputValue.trim()}
                        classes="bg-black-100 text-gray-500 rounded-[0px] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!writeRelayInputValue.trim()
                            ? 'Enter a relay URL first'
                            : 'Add outbox relay'}
                    >
                        <i class="bx bx-plus"></i>
                    </Button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
            >
                {#if writeRelayUrls.length > 0}
                    {#each writeRelayUrls as relayUrl (relayUrl)}
                        <RelayListElement
                            {relayUrl}
                            onRemove={() => removeRelay(relayUrl, RelayType.WRITE)}
                        />
                    {/each}
                {:else}
                    <div
                        class="w-full min-h-[100px] rounded-[8px] bg-black-100 dark:bg-white-100 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center p-4 gap-2"
                    >
                        <i class="bx bx-send text-4xl text-red-500"></i>
                        <p class="font-[600] text-[18px] text-red-500">
                            No Outbox Relays Selected!
                        </p>
                        <p class="text-sm text-center opacity-70">
                            Add relays above or select from suggested relays below to publish your
                            notes.
                        </p>
                    </div>
                {/if}
            </div>
            {#if filteredSuggestedOutboxRelays.length}
                <p class="font-[500]">
                    <span class="font-[900]">Suggested</span>
                    Outbox Relays
                </p>
                <div
                    class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                >
                    {#each filteredSuggestedOutboxRelays as relayUrl (relayUrl)}
                        <RelayListElement
                            {relayUrl}
                            onAdd={() => addRelay(RelayType.WRITE, relayUrl)}
                            isSuggestedRelay
                        />
                    {/each}
                </div>
            {/if}
        </div>
        <Button
            onClick={updateRelays}
            disabled={posting || (readRelayUrls.length === 0 && writeRelayUrls.length === 0)}
            title={readRelayUrls.length === 0 && writeRelayUrls.length === 0
                ? 'Add at least one relay before broadcasting'
                : 'Broadcast relay configuration to Nostr network'}
            classes={readRelayUrls.length === 0 && writeRelayUrls.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''}
        >
            {#if posting}
                <i class="bx bx-loader-alt bx-spin mr-2"></i>
                Broadcasting...
            {:else}
                <i class="bx bx-broadcast mr-2"></i>
                Save & Broadcast to Nostr
            {/if}
        </Button>
    {/if}
</div>
