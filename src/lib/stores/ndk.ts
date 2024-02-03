import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import { get } from 'svelte/store';
import { writable } from "svelte/store";

import { localStorageStore } from '@skeletonlabs/skeleton';
import type { Writable } from 'svelte/store';
import { NDKPrivateKeySigner, NDKNip07Signer } from "@nostr-dev-kit/ndk";

export const DEFAULTRELAYURLS = [
    "wss://purplepag.es/",
    "wss://relay.nostr.band/",
    "wss://nos.lol/",
    "wss://relay.snort.social/",
    "wss://relay.damus.io/",
]

export enum LoginMethod {
    NIP07 = "nip07",
    Ephemeral = "ephemeral",
}

const ndkSvelte = new NDKSvelte({
    explicitRelayUrls: DEFAULTRELAYURLS,
    outboxRelayUrls: ["wss://purplepag.es"],
    enableOutboxModel: false,
});

await ndkSvelte.connect();
// save this in session storage when logging in or restoring cipher pk
// then check for pk store in login before trying to decrypt
export const sessionPK: Writable<string> = localStorageStore('pk', '',{ storage:'session' });
// Save this in local(NOT session) storage when adding or removing relays
// Always check for relays here when instantiating ndk
export const storedPool: Writable<string[] | undefined> = localStorageStore('pool', undefined);

// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);

console.log("NDK Connected");

export default ndk;





