import { writable } from 'svelte/store';
import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
export const INITIALRELAYURLS = [
    "wss://purplepag.es/",
    "wss://relay.nostr.band/",
    "wss://nos.lol/",
    "wss://relay.snort.social/",
    "wss://relay.damus.io/",
]


export const ndkSvelte = new NDKSvelte({
    explicitRelayUrls: INITIALRELAYURLS,
    outboxRelayUrls: ["wss://purplepag.es"],
    enableOutboxModel: false,
});

await ndkSvelte.connect()
console.log("NDK Connected");

// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);

export default ndk;
