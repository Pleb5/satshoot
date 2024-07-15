<script lang="ts">
    import type { NDKRelay } from "@nostr-dev-kit/ndk";
    import { NDKRelayStatus } from '@nostr-dev-kit/ndk';

    export let relay: NDKRelay;
    let relayStatusColor: string;
    let relayStatusText: string;

    // console.log('relay in relay listelement', relay)
    // setTimeout(()=>{
    //     console.log('relay in relay listelement after delay', relay)
    // }, 8000);            

    $: if (relay && relay.status) {
        console.log('relay status changed: ', relay.status)
        if (
            relay.status == NDKRelayStatus.CONNECTING
                || relay.status === NDKRelayStatus.RECONNECTING
        ) {
            relayStatusColor = "variant-filled-warning";
            relayStatusText = "Connecting";
        } else if (relay.status == NDKRelayStatus.DISCONNECTED) {
            relayStatusColor = "variant-filled-error";
            relayStatusText = "Disconnected";
        } else if (relay.status == NDKRelayStatus.CONNECTED) {
            relayStatusColor = "variant-filled-success";
            relayStatusText = "Connected";
        } else if (relay.status == NDKRelayStatus.FLAPPING) {
            relayStatusColor = "variant-filled-warning";
            relayStatusText = "Flapping";
        } else if (relay.status === NDKRelayStatus.AUTHENTICATING) {
            relayStatusColor = "variant-filled-primary";
            relayStatusText = "Authenticating";
        }
    }

</script>

{#if relay}
    <div class="grid grid-cols-[1fr_40%] p-2 justify-center">
        <div class="text-md md:text-xl">
            { relay.url.replace("wss://","").slice(0, -1) }
        </div>
        <div class="badge {relayStatusColor} ">
            {relayStatusText}
        </div>
    </div>

{:else}
    <p>RELAY UNDEFINED!</p>
{/if}
