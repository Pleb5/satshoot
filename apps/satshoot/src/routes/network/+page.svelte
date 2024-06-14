<script lang="ts">
    import ndk, { DEFAULTRELAYURLS } from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { connected } from "$lib/stores/ndk";

    import { 
        fetchUserOutboxRelays,
        broadcastRelayList,
    } from '$lib/utils/helpers';

    import normalizeUrl from "normalize-url";

    import {
        NDKRelay,
        NDKRelayList,
        NDKSubscriptionCacheUsage,
        NDKRelaySet
    } from '@nostr-dev-kit/ndk';
    import RelayListElement from '$lib/components/Relays/RelayListElement.svelte';
    import { getModalStore, type ModalSettings } from '@skeletonlabs/skeleton';
    import { onMount, tick } from 'svelte';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

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
        console.log('ndk pool in network', $ndk.pool)
        console.log('ndk outbox pool in network', $ndk.outboxPool)
        console.log('read relays', readRelays)
        console.log('write relays', writeRelays)
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

    // Url normalization based on the idea of Coracle.social
    // https://github.com/coracle-social/paravel/blob/7cb792ba17550f208d3c80773c4822a010139ccb/src/util/nostr.ts#L46
    const stripProto = (url: string) => url.replace(/.*:\/\//, "")
    function normalizeRelayUrl(url: string) {
        url = normalizeUrl(url, {stripHash: true, stripAuthentication: false});

        // Strip protocol
        url = stripProto(url);

        // Url-s without pathnames are supposed to have a trailing slash
        if (!url.includes("/")) {
            url += "/";
        }

        return "wss://" + url;
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
            await broadcastRelayList($ndk, readRelayUrls, writeRelayUrls);
            posting = false;

            const t: ToastSettings = {
                message: 'New Relay Config Broadcasted!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            if (read) {
                readRelayInputValue = '';
            } else {
                writeRelayInputValue = '';
            }
            fetchOutboxRelays();
        } catch (e) {
            posting = false;
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
        let removeRelayResponse = async function(r: boolean){
            if (r) {
                if (!url) return;
                // Removal confirmed
                if (read) {
                    readRelayUrls.delete(url);
                } else {
                    writeRelayUrls.delete(url);
                }

                posting = true;
                await tick();

                try {
                    await broadcastRelayList($ndk, readRelayUrls, writeRelayUrls);

                    posting = false;

                    const t: ToastSettings = {
                        message: 'New Relay Config Broadcasted!',
                        timeout: 7000,
                        background: 'bg-success-300-600-token',
                    };
                    toastStore.trigger(t);

                    fetchOutboxRelays();
                } catch (e) {
                    posting = false;
                    const t: ToastSettings = {
                        message: 'Could not post Relays: ' + e,
                        timeout: 7000,
                        background: 'bg-error-300-600-token',
                    };
                    toastStore.trigger(t);
                    fetchOutboxRelays();
                }
            }
        }

        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirm Removal of Relay',
            body: `Do you really want to remove ${url.replace("wss://","").slice(0, -1)}?`,
            response: removeRelayResponse,
        };
        modalStore.trigger(modal);

    }

    $: if ($currentUser && $connected && needRelays) {
        needRelays = false;
        fetchOutboxRelays();
    }
    
    // $: if ($currentUser && $ndk.outboxTracker?.data) {
    //     const outboxData = $ndk.outboxTracker?.data.get($currentUser.pubkey)
    //     const writeRelays = outboxData?.writeRelays;
    //     const readRelays = outboxData?.readRelays;
    //     if (writeRelays && writeRelays.size > 0) {
    //         console.log('outbox write relays for user', writeRelays)
    //     }
    //     if (readRelays && readRelays.size > 0) {
    //         console.log('outbox read relays for user', readRelays)
    //     }
    // }

    onMount(()=>{
        $ndk.pool.on('connect', () => {
            updateRelayValues();
        });
        $ndk.pool.on('relay:connect', () => {
            updateRelayValues();
        });
        $ndk.pool.on('disconnect', () => {
            updateRelayValues();
        });
    });
</script>

<h3 class="h3 mb-4 text-center">Your Read Relays(Inbox)</h3>
{#if readRelays && readRelays.size > 0}
    <div class="flex flex-col gap-y-4 justify-center items-center mb-6 mx-2">
        {#each readRelays as relay(relay.url)}
            <div class="card card-hover grid grid-cols-[1fr_auto] gap-x-2 bg-surface-active-token p-4">
                <RelayListElement {relay}/>
                <button 
                    class="btn bg-error-500"
                    type="button" 
                    on:click={()=>{removeRelay(relay.url, true)}}>
                    Remove
                </button>
            </div> 
        {/each}
        <label class="label flex flex-col items-center mb-6">
            <h3 class="h3">Add READ Relay</h3>
            <div class="flex gap-x-2">
                <input class="input w-full text-center" 
                bind:value={readRelayInputValue}
                title="relay input (url)" 
                type="text" 
                placeholder="Relay URL, without ' wss:// '"
            />
                <button 
                    class="btn btn-icon"
                    type="button" 
                    on:click={()=>{addRelay(true)}}
                    disabled={posting}
                >
                    {#if posting}
                        <ProgressRadial
                        value={undefined}
                        stroke={60}
                        meter="stroke-primary-500"
                        track="stroke-primary-500/30"
                        strokeLinecap="round" width="w-8" 
                    />
                    {:else} 
                        <span>
                            <i 
                                class="text-3xl text-primary-500 fa-solid fa-circle-plus"
                            >
                            </i>
                        </span>
                    {/if}
                </button>
            </div>
        </label>
    </div>
{:else}
    <div class="p-4 space-y-4">
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
        <div class="grid grid-cols-3 gap-8">
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
        </div>
    </div>
{/if}
<hr class="mb-6"/>
<h3 class="h3 mb-4 text-center">Your Write Relays(Outbox)</h3>
{#if writeRelays && writeRelays.size > 0}

    <div class="flex flex-col gap-y-4 justify-center items-center mb-6 mx-2">
        {#each writeRelays as relay(relay.url)}
            <div class="card card-hover grid grid-cols-[1fr_auto] gap-x-2 bg-surface-active-token p-4">
                <RelayListElement {relay}/>
                <button 
                    class="btn bg-error-500"
                    type="button" 
                    on:click={()=>{removeRelay(relay.url, false)}}>
                    Remove
                </button>
            </div> 
        {/each}
        <label class="label flex flex-col items-center w-96 mb-6">
            <h3 class="h3">Add WRITE Relay</h3>
            <div class="flex gap-x-2">
                <input class="input w-full text-center" 
                bind:value={writeRelayInputValue}
                title="relay input (url)" 
                type="text" 
                placeholder="Relay URL, without ' wss:// '"
            />
                <button 
                    class="btn btn-icon"
                    type="button" 
                    on:click={()=>{addRelay(false)}}
                    disabled={posting}
                >
                    {#if posting}
                        <ProgressRadial
                        value={undefined}
                        stroke={60}
                        meter="stroke-primary-500"
                        track="stroke-primary-500/30"
                        strokeLinecap="round" width="w-8" 
                    />
                    {:else} 
                        <span>
                            <i 
                                class="text-3xl text-primary-500 fa-solid fa-circle-plus"
                            >
                            </i>
                        </span>
                    {/if}
                </button>
            </div>
        </label>
    </div>
{:else}
    <div class="p-4 space-y-4">
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
        <div class="grid grid-cols-3 gap-8">
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
        </div>
    </div>
{/if}
<!-- <div class="flex justify-center mb-6" > -->
<!--     <button  -->
<!--         class="btn btn-md bg-primary-300-600-token"  -->
<!--         on:click={() => location.reload()}> -->
<!--         Retry Connections -->
<!--     </button> -->
<!-- </div> -->
