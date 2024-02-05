import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import { get } from 'svelte/store';
import { writable } from "svelte/store";

import { localStorageStore } from '@skeletonlabs/skeleton';
import type { Writable } from 'svelte/store';
import { NDKPrivateKeySigner, NDKNip07Signer, NDKRelay } from "@nostr-dev-kit/ndk";
import { browser } from "$app/environment";

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
// Often in the app, the user profile needs to be restored(page refresh)
// This tries to add user relays to the pool. If user has set the relays already,
// We must not add these newly fetched relays back to the pool but conform to the stored pool in local storage
// This is achieved NOT by trying to remove relays after the fact but keep a black list of removed relays
export const blacklistedRelays: Writable<string[] | undefined> = localStorageStore('blacklistedRelays', undefined);

// save this in session storage when logging in or restoring cipher pk
// then check for pk store in login before trying to decrypt
export const sessionPK: Writable<string> = localStorageStore('pk', '',{ storage:'session' });
// Save this in local(NOT session) storage when adding or removing relays
// Always check for relays here when instantiating ndk
export const storedPool: Writable<string[] | undefined> = localStorageStore('pool', undefined);

const ndkSvelte = new NDKSvelte({
    enableOutboxModel: false,
    explicitRelayUrls:[],
});


// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);


export default ndk;





