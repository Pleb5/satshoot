import { writable } from 'svelte/store';
import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import currentUser from './currentUser';
import { get } from 'svelte/store';

export const INITIALRELAYURLS = [
    "wss://purplepag.es/",
    "wss://relay.nostr.band/",
    "wss://nos.lol/",
    "wss://relay.snort.social/",
    "wss://relay.damus.io/",
]

export let ndkSvelte:NDKSvelte;
const user = get(currentUser);
// If we have a current user set, we also have a usable ndk instance
if (user && user.ndk) {
    console.log(user)
    ndkSvelte = user.ndk as NDKSvelte;
} else {
    // We dont have current user, set a new ndk instance
    ndkSvelte = new NDKSvelte({
        explicitRelayUrls: INITIALRELAYURLS,
        outboxRelayUrls: ["wss://purplepag.es"],
        enableOutboxModel: false,
    });
}

await ndkSvelte.connect();

console.log("NDK Connected");

// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);

export default ndk;
