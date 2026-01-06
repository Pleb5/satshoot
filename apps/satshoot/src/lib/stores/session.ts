import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import NDK, { NDKRelayAuthPolicies } from '@nostr-dev-kit/ndk';
import { writable } from 'svelte/store';

import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';
import { APP_RELAY_STORAGE_KEY } from '$lib/utils/misc';

export const DEFAULTRELAYURLS = [
    'wss://nos.lol/',
    'wss://relay.damus.io/',
];

const BLACKLISTED_RELAYS = new Set(['wss://bitcoiner.social', 'wss://bitcoiner.social/']);

function sanitizeRelayUrls(relays: unknown): string[] {
    if (!Array.isArray(relays)) return DEFAULTRELAYURLS;

    const sanitized = relays
        .filter((url): url is string => typeof url === 'string')
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
        .filter((url) => !BLACKLISTED_RELAYS.has(url));

    return sanitized.length > 0 ? sanitized : DEFAULTRELAYURLS;
}

export const BOOTSTRAPOUTBOXRELAYS = [
    'wss://purplepag.es/',
    'wss://indexer.coracle.social/',
    'wss://relay.damus.io/',
    'wss://nos.lol/',
];

export const NOSTRCONNECTRELAYURLS = ['wss://relay.nsec.app'];

export const blastrUrl = 'wss://sendit.nosflare.com';

export enum RestoreMethod {
    Seed = 1,
    Nsec = 2,
}

export enum LoginMethod {
    Local = 'local',
    Nip07 = 'nip07',
    Nip46 = 'nip46',
    Register = 'Register',
}

// save this in session storage when logging in or restoring cipher pk
// then check for pk store in login before trying to decrypt
// Saves us from decryption every time user reloads page during a session
export const sessionPK: Writable<string> = persisted('pk', '', { storage: 'session' });

// Store top discovered relays from decentralized discovery
export const discoveredRelays: Writable<string[]> = persisted('discovered-relays', [], {
    storage: 'session',
});

export const sessionInitialized = writable(false);

// Load app relays from localStorage, fallback to defaults
export function getAppRelays(): string[] {
    if (typeof window === 'undefined') {
        return DEFAULTRELAYURLS;
    }

    let storage: Storage | undefined;
    try {
        storage = window.localStorage;
    } catch {
        return DEFAULTRELAYURLS;
    }

    if (typeof storage?.getItem !== 'function' || typeof storage?.setItem !== 'function') {
        return DEFAULTRELAYURLS;
    }

    try {
        const storedRelays = storage.getItem(APP_RELAY_STORAGE_KEY);
        if (storedRelays) {
            const parsed = JSON.parse(storedRelays);
            const sanitized = sanitizeRelayUrls(parsed);
            if (!Array.isArray(parsed) || JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
                storage.setItem(APP_RELAY_STORAGE_KEY, JSON.stringify(sanitized));
            }
            return sanitized;
        } else {
            // No saved relays, save defaults to localStorage
            storage.setItem(APP_RELAY_STORAGE_KEY, JSON.stringify(DEFAULTRELAYURLS));
            return DEFAULTRELAYURLS;
        }
    } catch (e) {
        console.error('Error loading app relays from localStorage:', e);
        // Try to save defaults even after error
        try {
            storage.setItem(APP_RELAY_STORAGE_KEY, JSON.stringify(DEFAULTRELAYURLS));
        } catch (saveError) {
            console.error('Error saving default relays to localStorage:', saveError);
        }
    }
    return DEFAULTRELAYURLS;
}

// Client-side caching. Used for performance enhancement as well as a solution to identify
// new data and serve push notifications. Notify user when 'jobs of interest' change,
// that is, my jobs and jobs I bid on, as well as new messages
const ndkSvelte = new NDKSvelte({
    enableOutboxModel: true,
    outboxRelayUrls: BOOTSTRAPOUTBOXRELAYS,
    autoConnectUserRelays: true,
    autoFetchUserMutelist: true,
    explicitRelayUrls: getAppRelays(),
    relayAuthDefaultPolicy: NDKRelayAuthPolicies.signIn(),
});

export const bunkerNDK = writable(new NDK({ enableOutboxModel: false }));
export const bunkerRelayConnected = writable(false);

// Create a singleton instance that is the default export
const ndk = writable(ndkSvelte);

export default ndk;
