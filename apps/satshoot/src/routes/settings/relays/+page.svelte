<script lang="ts">
    import RelayRemovalConfirmation from '$lib/components/Modals/RelayRemovalConfirmation.svelte';
    import RelayListElement from '$lib/components/RelayListElement.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import { OnboardingStep, onboardingStep } from '$lib/stores/gui';
    import ndk, { connected, DEFAULTRELAYURLS } from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import {
        broadcastRelayList,
        checkRelayConnections,
        fetchUserOutboxRelays,
    } from '$lib/utils/helpers';
    import { normalizeRelayUrl } from '$lib/utils/misc';
    import { NDKRelayList } from '@nostr-dev-kit/ndk';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import { createToaster } from '@skeletonlabs/skeleton-svelte';
    import { onMount } from 'svelte';
    import { RelayType } from '$lib/stores/network';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';

    const modalStore = getModalStore();
    const toaster = createToaster();

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

        if (!url) return;

        if (relayType === RelayType.READ) {
            if (!readRelayUrls.includes(url)) {
                readRelayUrls = [...readRelayUrls, url];
            }

            readRelayInputValue = '';
        } else {
            if (!writeRelayUrls.includes(url)) {
                writeRelayUrls = [...writeRelayUrls, url];
            }

            writeRelayInputValue = '';
        }
    }

    async function handleRelayRemoval(url: string, relayType: RelayType) {
        if (relayType === RelayType.READ) {
            readRelayUrls = readRelayUrls.filter((relayUrl) => relayUrl !== url);
        } else {
            writeRelayUrls = writeRelayUrls.filter((relayUrl) => relayUrl !== url);
        }
    }

    function removeRelay(url: string, relayType: RelayType) {
        modalStore.trigger({
            type: 'component',
            component: {
                ref: RelayRemovalConfirmation,
                props: {
                    url,
                    onConfirm: async () => {
                        await handleRelayRemoval(url, relayType);
                    },
                },
            },
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

            if ($onboardingStep === OnboardingStep.Profile_Updated) {
                $onboardingStep = OnboardingStep.Relays_Configured;
            }
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
            <p class="font-[600]">Inbox Relays</p>
            <div class="flex flex-col gap-[5px]">
                <label class="m-[0px] text-[14px]" for="add-inbox-relay"> Add Relay </label>
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
                        on:click={() => addRelay(RelayType.READ)}
                        disabled={posting}
                        classes="bg-black-100 text-gray-500 rounded-[0px] hover:text-white"
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
                            on:remove={() => removeRelay(relayUrl, RelayType.READ)}
                        />
                    {/each}
                {:else}
                    <div
                        class="w-full min-h-[50px] rounded-[8px] bg-black-100 dark:bg-white-100 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                    >
                        <p class="font-[600] text-[18px] text-red-500">No Inbox Relays Selected!</p>
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
                            on:add={() => addRelay(RelayType.READ, relayUrl)}
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
                <label class="m-[0px] text-[14px]" for="add-inbox-relay"> Add Relay </label>
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
                        on:click={() => addRelay(RelayType.WRITE)}
                        disabled={posting}
                        classes="bg-black-100 text-gray-500 rounded-[0px] hover:text-white"
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
                            on:remove={() => removeRelay(relayUrl, RelayType.WRITE)}
                        />
                    {/each}
                {:else}
                    <div
                        class="w-full min-h-[50px] rounded-[8px] bg-black-100 dark:bg-white-100 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                    >
                        <p class="font-[600] text-[18px] text-red-500">
                            No Outbox Relays Selected!
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
                            on:add={() => addRelay(RelayType.WRITE, relayUrl)}
                            isSuggestedRelay
                        />
                    {/each}
                </div>
            {/if}
        </div>
        <Button
            on:click={updateRelays}
            disabled={posting || (readRelayUrls.length === 0 && writeRelayUrls.length === 0)}
        >
            Save
            {#if posting}
                <ProgressRing color="white" />
            {/if}</Button
        >
    {/if}
</div>
