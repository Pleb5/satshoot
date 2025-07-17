import { nip19 } from 'nostr-tools';
import {
    type NDKTag,
    type Hexpubkey,
    NDKKind,
    type NostrEvent,
    type NDKFilter,
    NDKEvent,
    NDKRelaySet,
    NDKSubscriptionCacheUsage,
} from '@nostr-dev-kit/ndk';
import normalizeUrl from 'normalize-url';
import type { RelayFirstFetchOpts } from './helpers';
import { get } from 'svelte/store';
import ndk from '$lib/stores/session';

export const JobsPerPage = 9;
export const ServicesPerPage = 9;

export const NostrBuildBlossomServer = 'https://blossom.band';

export const SatShootPubkey = 'e3244843f8ab6483827e305e5b9d7f61b9eb791aa274d2a36836f3999c767650';

export const PablosNpub = 'npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft';

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
    `sign_event:${NDKKind.FreelanceJob}`,
    `sign_event:${NDKKind.FreelanceBid}`,
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
    return amount?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function abbreviateNumber(num: number): string {
    const suffixes = ['', 'K', 'M', 'B', 'T']; // Extendable for larger units
    let tier = 0;

    // Determine the appropriate tier for abbreviation
    while (Math.abs(num) >= 1000 && tier < suffixes.length - 1) {
        num /= 1000;
        tier++;
    }

    // Format the number to 1 decimal place if it has a fraction
    const formattedNum = num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);

    return `${formattedNum}${suffixes[tier]}`;
}

export function linkifyText(text: string): string {
    // test with https://www.example.com/some/long/url
    // Regular expression to detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Replace URLs with <a> tags, using the URL class to parse the URLs
    return text.replace(urlRegex, (urlString) => {
        try {
            // Create a URL object
            const url = new URL(urlString);

            // Shorten the displayed URL text to 20 characters with '...'
            const displayText =
                urlString.length > 20 ? urlString.substring(0, 20) + '...' : urlString;

            // Return the HTML anchor tag
            return `<a class='anchor' href="${url.href}" target="_blank">${displayText}</a>`;
        } catch (e) {
            // If an invalid URL is encountered, just return the original text
            return urlString;
        }
    });
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

export function getFileExtension(filename: string): string | null {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()! : null;
}

// Function to clip text up to maxLength + next whitespace
export function clipText(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;

    // Find the next whitespace after maxLength
    let clippedText = text.slice(0, maxLength);
    const nextWhitespaceIndex = text.slice(maxLength).search(/\s/);

    if (nextWhitespaceIndex !== -1) {
        clippedText = text.slice(0, maxLength + nextWhitespaceIndex);
    }

    return clippedText + ' ...';
}


export function clipMarkdownText(
    text: string, 
    maxLength: number
): string {
    if (text.length <= maxLength) return text;

    // Pre-process to identify special patterns and their rendered lengths
    const specialPatterns = [
        {
            regex: /(nostr:)?n(event|ote|pub|profile|addr)([a-zA-Z0-9]{10,1000})/g,
            getRenderedLength: (match: string) => 20,
        },
        {
            regex: /[^\s@]+@[^\s@]+\.[^\s@]+/g,
            getRenderedLength: (match: string) => Math.min(match.length, 30),
        },
        {
            regex: /https?:\/\/[^\s]+/g,
            getRenderedLength: (match: string) => Math.min(match.length, 40), 
        }
    ];

    // Calculate positions and rendered lengths
    let positions: Array<{start: number, end: number, renderedLength: number}> = [];
    
    for (const pattern of specialPatterns) {
        const matches = Array.from(text.matchAll(pattern.regex));
        for (const match of matches) {
            positions.push({
                start: match.index!,
                end: match.index! + match[0].length,
                renderedLength: pattern.getRenderedLength(match[0])
            });
        }
    }

    // Sort positions by start index
    positions.sort((a, b) => a.start - b.start);

    // Calculate where to clip based on rendered length
    let currentPos = 0;
    let renderedLength = 0;
    let clipIndex = text.length;

    for (let i = 0; i < text.length; i++) {
        // Check if we're at the start of a special pattern
        const pattern = positions.find(p => p.start === i);
        
        if (pattern) {
            if (renderedLength + pattern.renderedLength > maxLength) {
                // Clip before this pattern
                clipIndex = i;
                break;
            }
            // Skip to end of pattern
            renderedLength += pattern.renderedLength;
            i = pattern.end - 1;
        } else {
            // Regular character
            const isInsidePattern = positions.some(p => i >= p.start && i < p.end);
            if (!isInsidePattern) {
                renderedLength++;
                if (renderedLength >= maxLength) {
                    clipIndex = i;
                    break;
                }
            }
        }
    }

    // Find word boundary
    if (clipIndex < text.length) {
        const beforeClip = text.slice(0, clipIndex);
        const lastSpaceIndex = beforeClip.lastIndexOf(' ');
        
        if (lastSpaceIndex > maxLength * 0.7) {
            clipIndex = lastSpaceIndex;
        }
    }

    return text.slice(0, clipIndex) + (clipIndex < text.length ? ' ...' : '');
}

// Url normalization based on the idea of Coracle.social
// https://github.com/coracle-social/paravel/blob/7cb792ba17550f208d3c80773c4822a010139ccb/src/util/nostr.ts#L46
const stripProto = (url: string) => url.replace(/.*:\/\//, '');

export function normalizeRelayUrl(url: string) {
    url = normalizeUrl(url, { stripHash: true, stripAuthentication: false });

    // Strip protocol
    url = stripProto(url);

    // Url-s without pathnames are supposed to have a trailing slash
    if (!url.includes('/')) {
        url += '/';
    }

    return 'wss://' + url;
}

export async function fetchEventFromRelaysFirst(
    filter: NDKFilter,
    fetchOpts: RelayFirstFetchOpts = {
        relayTimeoutMS: 6000,
        fallbackToCache: false,
    }
): Promise<NDKEvent | null> {
    const $ndk = get(ndk);

    // If relays are provided construct a set and pass over to sub
    const relaySet = fetchOpts.explicitRelays
        ? new NDKRelaySet(new Set(fetchOpts.explicitRelays), $ndk)
        : undefined;

    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            resolve(null);
        }, fetchOpts.relayTimeoutMS);
    });

    const relayPromise = $ndk.fetchEvent(
        filter,
        {
            cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
            groupable: false,
        },
        relaySet
    );

    const fetchedEvent: NDKEvent | null = (await Promise.race([
        timeoutPromise,
        relayPromise,
    ])) as NDKEvent | null;

    if (fetchedEvent) {
        return fetchedEvent;
    } else if (!fetchedEvent && !fetchOpts.fallbackToCache) {
        return null;
    }

    console.warn('Could not fetch event from relays, fetching from Cache...');
    const cachedEvent = await $ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE,
        groupable: false,
    });

    return cachedEvent;
}
