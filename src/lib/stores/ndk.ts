import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import NDK from "@nostr-dev-kit/ndk";
import { writable } from "svelte/store";

import { localStorageStore } from '@skeletonlabs/skeleton';
import type { Writable } from 'svelte/store';


export const DEFAULTRELAYURLS = [
    "wss://relay.nostr.band/",
    "wss://nos.lol/",
    "wss://bitcoiner.social/",
    "wss://relay.damus.io/",
]

const OUTBOXRELAYURLS = [
    "wss://purplepag.es/",
    "wss://relay.damus.io/",
    "wss://relay.nostr.band/"
];

export enum RestoreMethod {
    Seed = 1,
    Nsec = 2,
}

export enum LoginMethod {
    Bunker = "bunker",
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
// Saves us from decryption every time user reloads page during a session
export const sessionPK: Writable<string> = localStorageStore('pk', '',{ storage:'session' });
// Save this in local(NOT session) storage when adding or removing relays
// Always check for relays here when instantiating ndk
export const storedPool: Writable<string[] | undefined> = localStorageStore('pool', undefined);

// Client-side caching. Used for performance enhancement as well as a solution to identify
// new data and serve push notifications. Notify user when 'tickets of interest' change,
// that is, my tickets and tickets I bid on, as well as new messages
const ndkSvelte = new NDKSvelte({
    enableOutboxModel: true,
    outboxRelayUrls: OUTBOXRELAYURLS,
    blacklistRelayUrls: [],
    autoConnectUserRelays: true,
    autoFetchUserMutelist: true,
    explicitRelayUrls:[],
});

export const connected = writable(false);

export const bunkerNDK = writable(new NDK({enableOutboxModel: false}));

// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);


export default ndk;





