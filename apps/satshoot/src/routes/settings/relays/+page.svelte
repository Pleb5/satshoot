<script lang="ts">
    import RelayRemovalConfirmation from '$lib/components/Modals/RelayRemovalConfirmation.svelte';
    import RelayListElement from '$lib/components/RelayListElement.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import { OnboardingStep, onboardingStep } from '$lib/stores/gui';
    import ndk, { connected } from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import {
        broadcastRelayList,
        checkRelayConnections,
        fetchUserOutboxRelays,
    } from '$lib/utils/helpers';
    import { normalizeRelayUrl } from '$lib/utils/misc';
    import { NDKRelayList, type NDKRelay } from '@nostr-dev-kit/ndk';
    import { getModalStore, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';
    import { onMount, tick } from 'svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let needRelays = true;
    let posting = false;

    let readRelayUrls: Set<string> = new Set();
    let writeRelayUrls: Set<string> = new Set();
    let readRelays: Set<NDKRelay> = new Set();
    let writeRelays: Set<NDKRelay> = new Set();

    let readRelayInputValue = '';
    let writeRelayInputValue = '';

    let relaysLoaded = false;

    $: if ($currentUser && $connected && needRelays) {
        needRelays = false;
        relaysLoaded = false;
        fetchOutboxRelays();
    }

    function updateRelayValues() {
        readRelays.clear();
        writeRelays.clear();
        const poolArray = Array.from($ndk.pool.relays.values());
        poolArray.forEach((poolRelay: NDKRelay) => {
            readRelayUrls.forEach((url: string) => {
                if (poolRelay.url === url) {
                    readRelays.add(poolRelay);
                }
            });

            writeRelayUrls.forEach((url: string) => {
                if (poolRelay.url === url) {
                    writeRelays.add(poolRelay);
                }
            });
        });

        readRelays = readRelays;
        writeRelays = writeRelays;
        console.log('ndk pool in network', $ndk.pool);
        console.log('ndk outbox pool in network', $ndk.outboxPool);
        console.log('read relays', readRelays);
        console.log('write relays', writeRelays);
    }

    async function fetchOutboxRelays() {
        const relays = await fetchUserOutboxRelays($ndk);

        if (relays) {
            const relayList = NDKRelayList.from(relays);

            relayList.readRelayUrls.forEach((url: string) => {
                readRelayUrls = readRelayUrls.add(url);
            });
            relayList.writeRelayUrls.forEach((url: string) => {
                writeRelayUrls = writeRelayUrls.add(url);
            });
        }

        updateRelayValues();
        relaysLoaded = true;
    }
    async function addRelay(read: boolean, url?: string) {
        if (!url) {
            url = read
                ? normalizeRelayUrl(readRelayInputValue)
                : normalizeRelayUrl(writeRelayInputValue);
        }

        if (!url) return;

        if (read) {
            readRelayUrls = readRelayUrls.add(url);
        } else {
            writeRelayUrls = writeRelayUrls.add(url);
        }

        posting = true;
        await tick();

        try {
            await broadcastRelayList($ndk, Array.from(readRelayUrls), Array.from(writeRelayUrls));

            posting = false;

            toastStore.trigger({
                message: 'New Relay Config Broadcasted!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            });

            if (read) {
                readRelayInputValue = '';
            } else {
                writeRelayInputValue = '';
            }

            if ($onboardingStep === OnboardingStep.Profile_Updated) {
                $onboardingStep = OnboardingStep.Relays_Configured;
            }

            fetchOutboxRelays();
        } catch (e) {
            posting = false;

            toastStore.trigger({
                message: 'Could not post Relays: ' + e,
                timeout: 7000,
                background: 'bg-error-300-600-token',
            });

            fetchOutboxRelays();
        }
    }

    async function handleRelayRemoval(url: string, read: boolean) {
        if (read) {
            readRelayUrls.delete(url);
            readRelayUrls = readRelayUrls;
        } else {
            writeRelayUrls.delete(url);
            writeRelayUrls = writeRelayUrls;
        }

        posting = true;
        await tick();

        try {
            await broadcastRelayList($ndk, Array.from(readRelayUrls), Array.from(writeRelayUrls));

            const t: ToastSettings = {
                message: 'New Relay Config Broadcasted!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            fetchOutboxRelays();
        } catch (e) {
            const t: ToastSettings = {
                message: 'Could not post Relays: ' + e,
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
            fetchOutboxRelays();
        }
    }

    function removeRelay(url: string, read: boolean) {
        modalStore.trigger({
            type: 'component',
            component: {
                ref: RelayRemovalConfirmation,
                props: {
                    url,
                    read,
                    onConfirm: async () => {
                        await handleRelayRemoval(url, read);
                    },
                },
            },
        });
    }

    onMount(() => {
        checkRelayConnections();
        $ndk.pool.on('connect', () => {
            updateRelayValues();
        });
        $ndk.pool.on('relay:connect', () => {
            updateRelayValues();
        });
        $ndk.pool.on('relay:disconnect', () => {
            updateRelayValues();
        });
    });

    const suggestedRelays = [
        'wss://nos.lol/',
        'wss://relay.damus.io/',
        'wss://relay.primal.net/',
    ].map((relayUrl) => $ndk.pool.getRelay(relayUrl, true));

    $: filteredSuggestedInboxRelays = suggestedRelays.filter(
        (relay) => !readRelayUrls.has(relay.url)
    );

    $: filteredSuggestedOutboxRelays = suggestedRelays.filter(
        (relay) => !writeRelayUrls.has(relay.url)
    );
</script>

<div class="w-full flex flex-col gap-[15px] overflow-y-auto">
    {#if !relaysLoaded}
        <!-- Placeholder Section -->
        {#each { length: 4 } as _}
            <section class="w-full">
                <div class="p-4 space-y-4">
                    <div class="placeholder animate-pulse" />
                    <div class="grid grid-cols-3 gap-8">
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                    </div>
                    <div class="grid grid-cols-4 gap-4">
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                    </div>
                </div>
            </section>
        {/each}
    {:else}
        <!-- Inbox Relays Section -->
        <div class="w-full flex flex-col gap-[10px]">
            <p class="font-[600]">Inbox Relays</p>
            <div class="flex flex-col gap-[5px]">
                <label class="m-[0px] text-[14px]" for="add-inbox-relay">
                    Add a custom relay server
                </label>
                <div
                    class="flex flex-row rounded-[6px] overflow-hidden bg-white dark:bg-brightGray border-[2px] border-black-100 dark:border-white-100 gap-[2px]"
                >
                    <Input
                        type="text"
                        placeholder="wss://"
                        bind:value={readRelayInputValue}
                        fullWidth
                        noBorder
                        notRounded
                    />
                    <Button
                        on:click={() => addRelay(true)}
                        disabled={posting}
                        classes="bg-black-100 text-gray-500 rounded-[0px] hover:text-white"
                    >
                        <i class="bx bx-plus" />
                    </Button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
            >
                {#each readRelays as relay (relay.url)}
                    <RelayListElement {relay} on:remove={() => removeRelay(relay.url, true)} />
                {/each}
            </div>

            {#if filteredSuggestedInboxRelays.length}
                <p class="font-[500]">Suggested Inbox Relays</p>
                <div
                    class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                >
                    {#each filteredSuggestedInboxRelays as relay (relay.url)}
                        <RelayListElement
                            {relay}
                            on:add={() => addRelay(true, relay.url)}
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
            <p class="font-[600]">Outbox Relays</p>
            <div class="flex flex-col gap-[5px]">
                <label class="m-[0px] text-[14px]" for="add-inbox-relay">
                    Add a custom relay server
                </label>
                <div
                    class="flex flex-row rounded-[6px] overflow-hidden bg-white dark:bg-brightGray border-[2px] border-black-100 dark:border-white-100 gap-[2px]"
                >
                    <Input
                        type="text"
                        placeholder="wss://"
                        bind:value={writeRelayInputValue}
                        fullWidth
                        noBorder
                        notRounded
                    />
                    <Button
                        on:click={() => addRelay(false)}
                        disabled={posting}
                        classes="bg-black-100 text-gray-500 rounded-[0px] hover:text-white"
                    >
                        <i class="bx bx-plus" />
                    </Button>
                </div>
            </div>
            <div
                class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
            >
                {#each writeRelays as relay (relay.url)}
                    <RelayListElement {relay} on:remove={() => removeRelay(relay.url, false)} />
                {/each}
            </div>
            {#if filteredSuggestedOutboxRelays.length}
                <p class="font-[500]">Suggested Outbox Relays</p>
                <div
                    class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                >
                    {#each filteredSuggestedOutboxRelays as relay (relay.url)}
                        <RelayListElement
                            {relay}
                            on:add={() => addRelay(false, relay.url)}
                            isSuggestedRelay
                        />
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>
