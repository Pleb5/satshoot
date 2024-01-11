import { writable } from 'svelte/store';
import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import type { NDKUserParams } from "@nostr-dev-kit/ndk";



export const ndkStore = new NDKSvelte({
    explicitRelayUrls: [
        "wss://purplepag.es",
        "wss://relay.nostr.band",
        "wss://nos.lol",
        "wss://relay.snort.social",
        "wss://relay.damus.io",
    ],
    outboxRelayUrls: ["wss://purplepag.es"],
    enableOutboxModel: false,
});

ndkStore.connect().then(() => console.log("NDK Connected"));
console.log("ndk.ts ran");

// Create a singleton instance that is the default export
const ndk = writable(ndkStore);

export default ndk;
