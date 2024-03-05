<script lang="ts">
    import type { NDKRelay } from "@nostr-dev-kit/ndk";
    import { NDKRelayStatus } from '@nostr-dev-kit/ndk';


    export let relay: NDKRelay;
    let relayStatusColor: string;
    let relayStatusText: string;

    $: {
        if (relay) {
            if (relay.status == NDKRelayStatus.CONNECTING) {
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
            }
        }
    }


</script>
{#if relay}
    <div class="grid grid-cols-10 p-4 justify-center items-center">
        <div class="text-xl col-span-6">{ relay.url.replace("wss://","").slice(0, -1) }</div>
        <div class="badge col-start-8 col-span-3 {relayStatusColor}">{relayStatusText}</div>
    </div>

{:else}
    <p>RELAY UNDEFINED!</p>
{/if}
