import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import NDK from "@nostr-dev-kit/ndk";
import { writable } from "svelte/store";

import { persisted } from "svelte-persisted-store";
import type { Writable } from 'svelte/store';


export const DEFAULTRELAYURLS = [
    // "wss://relay.nostr.band/",
    "wss://nos.lol/",
    "wss://bitcoiner.social/",
    "wss://relay.damus.io/",
    "wss://relay.primal.net/",
]

export const OUTBOXRELAYURLS = [
    "wss://purplepag.es/",
    "wss://relay.damus.io/",
    "wss://relay.primal.net/",
    // "wss://relay.nostr.band/",
    // "wss://nos.lol/",
    // "wss://bitcoiner.social/",
];

export enum RestoreMethod {
    Seed = 1,
    Nsec = 2,
}

export type LoginMethod = "bunker" | "nip07" | "local";

// save this in session storage when logging in or restoring cipher pk
// then check for pk store in login before trying to decrypt
// Saves us from decryption every time user reloads page during a session
export const sessionPK: Writable<string> = 
        persisted('pk', '',{ storage:'session' });

// Client-side caching. Used for performance enhancement as well as a solution to identify
// new data and serve push notifications. Notify user when 'tickets of interest' change,
// that is, my tickets and tickets I bid on, as well as new messages
const ndkSvelte = new NDKSvelte({
    enableOutboxModel: true,
    outboxRelayUrls: OUTBOXRELAYURLS,
    blacklistRelayUrls: [],
    autoConnectUserRelays: true,
    autoFetchUserMutelist: true,
    explicitRelayUrls: DEFAULTRELAYURLS,
});

export const connected = writable(false);

export const bunkerNDK = writable(new NDK({enableOutboxModel: false}));

// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);


export default ndk;





