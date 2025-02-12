<script lang="ts">
    import RelayRemovalConfirmation from '$lib/components/Modals/RelayRemovalConfirmation.svelte';
    import RelayListElement from '$lib/components/RelayListElement.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ndk, { connected } from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import {
        broadcastRelayList,
        checkRelayConnections,
        fetchUserOutboxRelays,
    } from '$lib/utils/helpers';
    import { normalizeRelayUrl } from '$lib/utils/misc';
    import { NDKRelayList, type NDKRelay } from '@nostr-dev-kit/ndk';
    import {
        getModalStore,
        getToastStore,
        type ModalSettings,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import { onMount, tick } from 'svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let needRelays = true;
    let posting = false;

    const readRelayUrls: Set<string> = new Set();
    const writeRelayUrls: Set<string> = new Set();
    let readRelays: Set<NDKRelay> = new Set();
    let writeRelays: Set<NDKRelay> = new Set();

    let readRelayInputValue = '';
    let writeRelayInputValue = '';

    $: if ($currentUser && $connected && needRelays) {
        needRelays = false;
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
                readRelayUrls.add(url);
            });
            relayList.writeRelayUrls.forEach((url: string) => {
                writeRelayUrls.add(url);
            });
        }

        updateRelayValues();
    }

    async function addRelay(read: boolean) {
        const url: string = read
            ? normalizeRelayUrl(readRelayInputValue)
            : normalizeRelayUrl(writeRelayInputValue);

        if (!url) return;

        if (read) {
            readRelayUrls.add(url);
        } else {
            writeRelayUrls.add(url);
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
        } else {
            writeRelayUrls.delete(url);
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
</script>

<div class="w-full flex flex-col gap-[15px] overflow-y-auto">
    <!-- Inbox Relays Section -->
    <div class="w-full flex flex-col gap-[10px]">
        <p class="font-[600]">Inbox Relays</p>
        <div class="flex flex-col gap-[5px]">
            <label class="m-[0px] text-[14px]" for="add-inbox-relay">
                Add a custom relay server
            </label>
            <div
                class="flex flex-row rounded-[6px] overflow-hidden bg-white border-[2px] border-black-100 gap-[2px]"
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
        <div class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100">
            {#each readRelays as relay (relay.url)}
                <RelayListElement {relay} on:remove={() => removeRelay(relay.url, true)} />
            {/each}
        </div>
    </div>

    <!-- Outbox Relays Section -->
    <div
        class="w-full flex flex-col gap-[10px] border-t-[1px] border-black-200 pt-[10px] mt-[10px]"
    >
        <p class="font-[600]">Outbox Relays</p>
        <div class="flex flex-col gap-[5px]">
            <label class="m-[0px] text-[14px]" for="add-inbox-relay">
                Add a custom relay server
            </label>
            <div
                class="flex flex-row rounded-[6px] overflow-hidden bg-white border-[2px] border-black-100 gap-[2px]"
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
        <div class="w-full flex flex-col gap-[10px] pt-[10px] border-t-[1px] border-black-100">
            {#each writeRelays as relay (relay.url)}
                <RelayListElement {relay} on:remove={() => removeRelay(relay.url, false)} />
            {/each}
        </div>
    </div>
</div>
