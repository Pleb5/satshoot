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
    <div class="grid grid-cols-2 w-96 justify-between p-4 ">
        <div class="text-xl">{ relay.url.replace("wss://","").slice(0, -1) }</div>
        <div class="badge justify-self-end {relayStatusColor}">{relayStatusText}</div>
    </div>

{:else}
    <p>RELAY UNDEFINED!</p>
{/if}
