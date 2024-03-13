<script lang="ts">

    import ndk from '$lib/stores/ndk';
    import {blacklistedRelays, storedPool } from "$lib/stores/ndk";

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
        // update UI then sync to local storage
        relays = Array.from($ndk.pool.relays.values());

        // relays are destroyed when page refreshes, we need to only sync when
        // there are values to be synced
        if (relays.length > 0){
            storedPool.set($ndk.pool.urls());

            blacklistedRelays.set(
                Array.from($ndk.pool.blacklistRelayUrls.keys())
            );
        }
    }


    function removeRelay(relay: NDKRelay) {

        let removeRelayResponse = function(r: boolean){
            if (r) {
                // Removal confirmed, remove the relay. Only remove from app
                // Don't remove from nostr-wide relay list(nip 65)
                $ndk.pool.removeRelay(relay.url);

                $ndk.explicitRelayUrls = 
                    $ndk.explicitRelayUrls?.filter((explicitRelay) => {
                        relay.url !== explicitRelay;
                    });


                $ndk.pool.blacklistRelayUrls.add(relay.url);

                update();
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
    
    // Inform users with a tooltip that this does not change the nostr-wide
    // user relays, it just saves this preference locally which disappears on logout or browser local data clearance
    function addRelay() {
        const url: string = normalizeRelayUrl(relayInputValue);

        $ndk.pool.blacklistRelayUrls.delete(url);

        if (!($ndk.explicitRelayUrls?.includes(url))) {
            $ndk.addExplicitRelay(url);
        }


        relayInputValue = "";
        update();
    }
</script>

<div class="flex flex-col items-center space-y-16 mb-8 mt-8">
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
<div class="flex flex-col gap-y-6 justify-center items-center mb-10 mx-2">
    {#each relays as relay}
        <div class="card card-hover bg-surface-active-token flex flex-col items-center p-4">
            <RelayListElement relay = {relay}/>
            <button 
                class="btn bg-error-400-500-token w-52" 
                on:click={ () => {removeRelay(relay)} }
            >
                Remove
            </button>
        </div> 
    {/each}
</div>
