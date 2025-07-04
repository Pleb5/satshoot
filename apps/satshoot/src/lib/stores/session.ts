import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import NDK from '@nostr-dev-kit/ndk';
import { writable } from 'svelte/store';

import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

export const DEFAULTRELAYURLS = [
    // "wss://relay.nostr.band/",
    'wss://nos.lol/',
    'wss://bitcoiner.social/',
    'wss://relay.damus.io/',
];

export const BOOTSTRAPOUTBOXRELAYS = [
    'wss://purplepag.es/',
    'wss://indexer.coracle.social/',
    'wss://relay.damus.io/',
    // "wss://relay.nostr.band/",
    // "wss://nos.lol/",
    // "wss://bitcoiner.social/",
];

export const blastrUrl = 'wss://sendit.nosflare.com';

export enum RestoreMethod {
    Seed = 1,
    Nsec = 2,
}

export enum LoginMethod {
    Bunker = 'bunker',
    Nip07 = 'nip07',
    Local = 'local',
    Register = 'Register',
}

// save this in session storage when logging in or restoring cipher pk
// then check for pk store in login before trying to decrypt
// Saves us from decryption every time user reloads page during a session
export const sessionPK: Writable<string> = persisted('pk', '', { storage: 'session' });

export const sessionInitialized = writable(false);

// Client-side caching. Used for performance enhancement as well as a solution to identify
// new data and serve push notifications. Notify user when 'jobs of interest' change,
// that is, my jobs and jobs I bid on, as well as new messages
const ndkSvelte = new NDKSvelte({
    enableOutboxModel: true,
    outboxRelayUrls: BOOTSTRAPOUTBOXRELAYS,
    blacklistRelayUrls: [],
    autoConnectUserRelays: true,
    autoFetchUserMutelist: true,
    explicitRelayUrls: DEFAULTRELAYURLS,
});

export const bunkerNDK = writable(new NDK({ enableOutboxModel: false }));
export const bunkerRelayConnected = writable(false);

// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);

export default ndk;
