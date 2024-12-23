import { nip19 } from 'nostr-tools';
import { type NDKTag, type Hexpubkey, NDKKind, type NostrEvent } from '@nostr-dev-kit/ndk';

export const SatShootPubkey = 'e3244843f8ab6483827e305e5b9d7f61b9eb791aa274d2a36836f3999c767650';

if (typeof NDKKind === 'undefined') {
    throw new Error('NDKKind is undefined. Check your imports.');
}

export const bunkerPerms = [
    'get_public_key',
    'get_relays',
    'nip04_encrypt',
    'nip04_decrypt',
    'nip44_encrypt',
    'nip44_decrypt',
    `sign_event:${NDKKind.FreelanceTicket}`,
    `sign_event:${NDKKind.FreelanceOffer}`,
    `sign_event:${NDKKind.Metadata}`,
    `sign_event:${NDKKind.Text}`,
    `sign_event:${NDKKind.EncryptedDirectMessage}`,
    `sign_event:${NDKKind.Review}`,
    `sign_event:${NDKKind.ZapRequest}`,
    `sign_event:${NDKKind.CashuWallet}`,
    `sign_event:${NDKKind.CashuMintList}`,
    `sign_event:${NDKKind.WalletChange}`,
    `sign_event:${NDKKind.CashuQuote}`,
    `sign_event:${NDKKind.CashuToken}`,
    `sign_event:${NDKKind.EventDeletion}`,
    `sign_event:${NDKKind.Nutzap}`,
    `sign_event:${NDKKind.RelayList}`,
    `sign_event:${NDKKind.HttpAuth}`,
];

interface SetSerializer {
    stringify: (set: Set<string>) => string;
    parse: (json: string) => Set<string>;
}

interface MapSerializer<K, V> {
    stringify: (map: Map<K, V>) => string;
    parse: (json: string) => Map<K, V>;
}

export function getSetSerializer(): SetSerializer {
    return {
        stringify: (set: Set<string> | null) => {
            if (!set) return JSON.stringify(null);
            return JSON.stringify(Array.from(set));
        },
        parse: (json: string) => {
            if (json === 'null') return new Set<string>();
            return new Set<string>(JSON.parse(json));
        },
    };
}

export function getMapSerializer<K, V>(): MapSerializer<K, V> {
    return {
        stringify: (map: Map<K, V> | null) => {
            if (!map) return JSON.stringify(null);
            return JSON.stringify(Array.from(map.entries()));
        },

        parse: (json: string) => {
            const map: Map<K, V> = new Map();
            const parsedJson = JSON.parse(json);

            if (parsedJson === null) return map;

            const array: Array<[K, V]> = Array.from(parsedJson);
            array.forEach(([key, value]) => {
                map.set(key, value);
            });
            return map;
        },
    };
}

export function percentile(arr: number[], val: number) {
    let count = 0;
    arr.forEach((v) => {
        if (v < val) {
            count++;
        } else if (v == val) {
            count += 0.5;
        }
    });
    return Math.floor((100 * count) / arr.length);
}

export const filterValidPTags = (tags: NDKTag[]) =>
    tags
        .filter((t: NDKTag) => t[0] === 'p')
        .map((t: NDKTag) => t[1])
        .filter((f: Hexpubkey) => {
            try {
                nip19.npubEncode(f);
                return true;
            } catch {
                return false;
            }
        });

export function insertThousandSeparator(amount: number) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function isNDKTagArray(value: any): value is NDKTag[] {
    return (
        Array.isArray(value) &&
        value.every((tag) => Array.isArray(tag) && tag.every((item) => typeof item === 'string'))
    );
}

export function isNostrEvent(value: any): value is NostrEvent {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof value.created_at === 'number' &&
        typeof value.content === 'string' &&
        isNDKTagArray(value.tags) &&
        typeof value.pubkey === 'string' &&
        (typeof value.kind === 'undefined' || typeof value.kind === 'number') &&
        (typeof value.id === 'undefined' || typeof value.id === 'string') &&
        (typeof value.sig === 'undefined' || typeof value.sig === 'string')
    );
}

/**
 * Creates a debounced version of a function, which delays invoking the function
 * until after a specified delay has passed since the last time it was called.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    // Variable to hold the timeout ID, used to clear the timeout on repeated calls
    let timeout: ReturnType<typeof setTimeout> | null = null;

    // Debounced function with the core debouncing logic
    const debounced = (...args: Parameters<T>): void => {
        // Clear the previous timeout, if any, to reset the delay
        if (timeout) clearTimeout(timeout);

        // Set a new timeout to invoke the function after the delay
        timeout = setTimeout(() => fn(...args), delay);
    };

    // Attach a clear method to allow external clearing of the timeout
    debounced.clear = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
    };

    return debounced;
}
