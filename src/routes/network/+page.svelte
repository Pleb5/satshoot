<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import RelayList from '$lib/components/Relays/UserRelayList.svelte';
    import normalizeUrl from "normalize-url";

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
        $ndk.addExplicitRelay(normalizeRelayUrl(relayInputValue));
        relayInputValue = "";
    }
</script>

<div class="card bg-surface-100-800-token w-screen h-screen flex flex-col items-center space-y-16">
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
					
    <RelayList />
</div>
