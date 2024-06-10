<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { connected } from "$lib/stores/ndk";

    import normalizeUrl from "normalize-url";

    import { NDKRelay, NDKRelayList, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import RelayListElement from '$lib/components/Relays/RelayListElement.svelte';
    import { getModalStore, type ModalSettings } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();

    let needRelays = true;

    let readRelays: Set<NDKRelay> = new Set();
    let writeRelays: Set<NDKRelay> = new Set();

    let readRelayInputValue = '';
    let writeRelayInputValue = '';


    async function fetchOutboxRelays() {
        const relays = await $ndk.fetchEvent(
            { kinds: [10002], authors: [$currentUser!.pubkey] },
            { 
                cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
                groupable: false,
            }
        );
        console.log('outbox relays', relays)

        const readRelayUrls: Set<string> = new Set();
        const writeRelayUrls: Set<string> = new Set();

        if (relays) {
            const relayList = NDKRelayList.from(relays);

            relayList.readRelayUrls.forEach((url: string) => {
                readRelayUrls.add(url);
            });
            relayList.writeRelayUrls.forEach((url: string) => {
                writeRelayUrls.add(url);
            });
        }

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

    function addRelay(read: boolean) {
        const url: string = read 
            ? normalizeRelayUrl(readRelayInputValue)
            : normalizeRelayUrl(writeRelayInputValue);

       // TODO: push relay list as 10002 with blastr and reload relays 

    }

    function removeRelay(relay: NDKRelay, read: boolean) {
        let removeRelayResponse = function(r: boolean){
            if (r) {
                // Removal confirmed
                if (read) {

                } else {

                }
                // TODO: push relay list as 10002 with blastr and user relays then reload relays 

            }
        }

        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirm Removal of Relay',
            body: `Do you really want to remove ${relay.url.replace("wss://","").slice(0, -1)}?`,
            response: removeRelayResponse,
        };
        modalStore.trigger(modal);

    }

    $: if ($currentUser && $connected && needRelays) {
        // needRelays = false;
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
</script>

<h3 class="h3 mb-4 text-center">Your Read Relays(Inbox)</h3>
<div class="flex flex-col gap-y-4 justify-center items-center mb-6 mx-2">
    {#each readRelays as relay(relay.url)}
        <div class="card card-hover grid grid-cols-[1fr_auto] gap-x-2 bg-surface-active-token p-4">
            <RelayListElement {relay}/>
            <button 
                class="btn bg-error-500"
                type="button" 
                on:click={()=>{removeRelay(relay, true)}}>
                Remove
            </button>
        </div> 
    {/each}
    <div class="w-80 mb-6">
        <label class="label flex flex-col items-center">
            <h3 class="h3">Add READ Relay</h3>
            <input class="input w-full text-center" 
            bind:value={readRelayInputValue}
            title="relay input (url)" 
            type="text" 
            placeholder="Enter Relay URL(without wss://)"
        />
        </label>
    </div>
</div>
<hr class="mb-6"/>
<h3 class="h3 mb-4 text-center">Your Write Relays(Outbox)</h3>
<div class="flex flex-col gap-y-4 justify-center items-center mb-6 mx-2">
    {#each writeRelays as relay(relay.url)}
        <div class="card card-hover grid grid-cols-[1fr_auto] gap-x-2 bg-surface-active-token p-4">
            <RelayListElement {relay}/>
            <button 
                class="btn bg-error-500"
                type="button" 
                on:click={()=>{removeRelay(relay, false)}}>
                Remove
            </button>
        </div> 
    {/each}
    <div class="w-80 mb-6">
        <label class="label flex flex-col items-center">
            <h3 class="h3">Add WRITE Relay</h3>
            <input class="input w-full text-center" 
            bind:value={writeRelayInputValue}
            title="relay input (url)" 
            type="text" 
            placeholder="Enter Relay URL(without wss://)"
        />
        </label>
    </div>
</div>
<div class="flex justify-center mb-6" >
    <button class="btn btn-md bg-primary-300-600-token" on:click={() => location.reload()}>
        Retry Connections
    </button>
</div>
