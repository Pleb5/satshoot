<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { storedPool } from "$lib/stores/ndk";

    import normalizeUrl from "normalize-url";
    import type { NDKRelay } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';

    import { type ModalSettings, getModalStore } from '@skeletonlabs/skeleton';
    import RelayListElement from '$lib/components/Relays/RelayListElement.svelte';

    const modalStore = getModalStore();

    let relays: NDKRelay[] = [];
    let notices: Map<NDKRelay, string[]> = new Map();

    onMount(() => {
        update();
        $ndk.pool.on('connect', () => {
            update();
        });
        $ndk.pool.on('relay:connect', () => {
            update();
        });
        $ndk.pool.on('disconnect', () => {
            update();
        });
        $ndk.pool.on('notice', relayNotice);
    });


    function relayNotice(relay: NDKRelay, notice: string) {
        if (!notices.has(relay)) {
            notices.set(relay, []);
        }

        notices.get(relay)?.push(notice);
        notices = notices;

        setTimeout(() => {
            notices.get(relay)?.shift();
            notices = notices;
        }, 60000);
    }

    
    function update() {
        relays = Array.from($ndk.pool.relays.values());
    }


    function removeRelay(relay: NDKRelay) {

        let removeRelayResponse = function(r: boolean){
            if (r) {
                // Removal confirmed, remove the relay. Only remove from pool
                // Don't remove from user-defined relays list(nip 65)
                $ndk.pool.removeRelay(relay.url);
                $storedPool = $storedPool.filter((storedRelay:string) => storedRelay !== relay.url);
                storedPool.set($storedPool);
                console.log('removed relay: ', relay.url)
                update();
            }
        }


        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirm Removal of Relay',
            body: "Do you really want to remove this Relay?",
            response: removeRelayResponse,
        };
        modalStore.trigger(modal);
    }

    let relayInputValue: string;

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
    
    // Todo: Check if this approach works:
    // Going to other pages and page refreshes might erase all added Relays
    // and start from scratch (onMount in layout.svelte reloads ndk and user)
    function addRelay() {
        const url: string = normalizeRelayUrl(relayInputValue);
        $ndk.addExplicitRelay(url);
        relayInputValue = "";
        $storedPool.push(url);
        storedPool.set($storedPool);
        update();
    }
</script>

<div class="flex flex-col items-center space-y-16 mb-8">
    <header class="card-header"><h2 class="h2">Network Settings</h2></header>

    <div class="w-80">
        <form on:submit={addRelay}>
            <label class="label flex flex-col items-center">
                <h3 class="h3">Add Relay</h3>
                <input class="input w-full text-center" 
                    bind:value={relayInputValue}
                    title="relay input (url)" 
                    type="text" 
                    placeholder="Enter Relay URL(without wss://)"
                />
            </label>
        </form>
    </div>
</div>
    <div>
</div>
<div class="flex flex-col gap-y-6 justify-center items-center mb-10">
    {#each relays as relay}
        <div class="card card-hover bg-surface-active-token flex justify-between gap-x-16 p-4">
            <RelayListElement relay = {relay}/>
            <button 
                class="btn bg-error-400-500-token" 
                on:click={ () => {removeRelay(relay)} }
            >
                Remove
            </button>
        </div> 
    {/each}
</div>
