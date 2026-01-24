import type NDK from '@nostr-dev-kit/ndk';
import Dexie, { type Table } from 'dexie';
import {
    NDKDVMRequest,
    NDKKind,
    NDKRelaySet,
    NDKSubscriptionCacheUsage,
    type Hexpubkey,
    type NDKEvent,
    type NDKTag,
} from '@nostr-dev-kit/ndk';

export const VERTEX_RELAY_URL = 'wss://relay.vertexlab.io';
export const VERTEX_REPUTATION_REQUEST_KIND = 5312;
export const VERTEX_REPUTATION_RESPONSE_KIND = 6312;
export const VERTEX_REPUTATION_ERROR_KIND = 7000;
export const VERTEX_REPUTATION_SORT = 'personalizedPagerank';
export const VERTEX_REPUTATION_LIMIT = 5;
export const VERTEX_REPUTATION_TIMEOUT_MS = 20000;
export const VERTEX_CREDITS_KIND = 22243;
export const VERTEX_CREDITS_TIMEOUT_MS = 8000;
export const VERTEX_PRICING_URL = 'https://vertexlab.io/pricing/';

export interface VertexReputationEntry {
    pubkey: Hexpubkey;
    rank: number;
    follows?: number;
    followers?: number;
}

export interface VertexReputationResult {
    target: VertexReputationEntry;
    followers: VertexReputationEntry[];
    sort: string;
    source?: string;
    nodes?: string;
    raw: VertexReputationEntry[];
}

export interface VertexReputationCacheEntry {
    targetPubkey: Hexpubkey;
    fetchedAt: number;
    result: VertexReputationResult;
}

export interface VertexCreditsInfo {
    credits: number;
    lastRequest?: number;
}

class VertexReputationDatabase extends Dexie {
    results!: Table<VertexReputationCacheEntry, Hexpubkey>;

    constructor() {
        super('vertexReputation');
        this.version(1).stores({
            results: 'targetPubkey,fetchedAt',
        });
    }
}

const vertexDb = new VertexReputationDatabase();

const getTagValue = (tags: NDKTag[], name: string): string | undefined =>
    tags.find((tag) => tag[0] === name)?.[1];

const parseNumberTag = (tags: NDKTag[], name: string): number | undefined => {
    const value = getTagValue(tags, name);
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
};

export const parseVertexReputationResponse = (event: NDKEvent): VertexReputationResult => {
    let parsed: VertexReputationEntry[];

    try {
        parsed = JSON.parse(event.content) as VertexReputationEntry[];
    } catch (error) {
        throw new Error('Vertex response could not be parsed.');
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Vertex response was empty.');
    }

    const [target, ...followers] = parsed;

    return {
        target,
        followers: followers.slice(0, VERTEX_REPUTATION_LIMIT),
        sort: getTagValue(event.tags, 'sort') ?? VERTEX_REPUTATION_SORT,
        source: getTagValue(event.tags, 'source'),
        nodes: getTagValue(event.tags, 'nodes'),
        raw: parsed,
    };
};

export const getVertexErrorMessage = (event: NDKEvent): string => {
    const statusTag = event.tags.find((tag) => tag[0] === 'status');

    if (statusTag?.[2]) {
        return statusTag[2];
    }

    if (statusTag?.[1]) {
        return statusTag[1];
    }

    return 'Vertex returned an unknown error.';
};

export const getCachedVertexReputation = async (
    targetPubkey: Hexpubkey
): Promise<VertexReputationCacheEntry | undefined> => vertexDb.results.get(targetPubkey);

const waitForVertexResponse = (
    ndk: NDK,
    relaySet: NDKRelaySet,
    requestId: string,
    timeoutMs: number
): Promise<NDKEvent> =>
    new Promise((resolve, reject) => {
        const subscription = ndk.subscribe(
            {
                kinds: [
                    VERTEX_REPUTATION_RESPONSE_KIND as NDKKind,
                    VERTEX_REPUTATION_ERROR_KIND as NDKKind,
                ],
                '#e': [requestId],
            },
            {
                closeOnEose: false,
                cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
                relaySet,
            }
        );

        const timeoutId = setTimeout(() => {
            subscription.stop();
            reject(new Error('Timed out waiting for Vertex response.'));
        }, timeoutMs);

        subscription.on('event', (event: NDKEvent) => {
            clearTimeout(timeoutId);
            subscription.stop();
            resolve(event);
        });
    });

const waitForVertexCredits = (
    ndk: NDK,
    relaySet: NDKRelaySet,
    timeoutMs: number
): Promise<VertexCreditsInfo> =>
    new Promise((resolve, reject) => {
        const subscription = ndk.subscribe(
            {
                kinds: [VERTEX_CREDITS_KIND as NDKKind],
            },
            {
                closeOnEose: false,
                cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
                relaySet,
            }
        );

        const timeoutId = setTimeout(() => {
            subscription.stop();
            reject(new Error('Timed out waiting for Vertex credits.'));
        }, timeoutMs);

        subscription.on('event', (event: NDKEvent) => {
            clearTimeout(timeoutId);
            subscription.stop();

            const credits = parseNumberTag(event.tags, 'credits');
            if (credits === undefined) {
                reject(new Error('Vertex credits response was missing credits.'));
                return;
            }

            resolve({
                credits,
                lastRequest: parseNumberTag(event.tags, 'lastRequest'),
            });
        });
    });

export async function requestVertexReputationWithCredits(
    ndk: NDK,
    targetPubkey: Hexpubkey,
    sourcePubkey: Hexpubkey,
    timeoutMs = VERTEX_REPUTATION_TIMEOUT_MS
): Promise<{ entry: VertexReputationCacheEntry; credits: VertexCreditsInfo | null }> {
    const relaySet = NDKRelaySet.fromRelayUrls([VERTEX_RELAY_URL], ndk, true);

    const request = new NDKDVMRequest(ndk);
    request.kind = VERTEX_REPUTATION_REQUEST_KIND;
    request.addParam('target', targetPubkey);
    request.addParam('sort', VERTEX_REPUTATION_SORT);
    request.addParam('limit', VERTEX_REPUTATION_LIMIT.toString());
    request.addParam('source', sourcePubkey);

    await request.publish(relaySet);

    const response = await waitForVertexResponse(ndk, relaySet, request.id, timeoutMs);

    if (response.kind === VERTEX_REPUTATION_ERROR_KIND) {
        throw new Error(getVertexErrorMessage(response));
    }

    const result = parseVertexReputationResponse(response);
    const entry: VertexReputationCacheEntry = {
        targetPubkey,
        fetchedAt: Date.now(),
        result,
    };

    await vertexDb.results.put(entry);

    let credits: VertexCreditsInfo | null = null;

    try {
        credits = await waitForVertexCredits(ndk, relaySet, VERTEX_CREDITS_TIMEOUT_MS);
    } catch (error) {
        console.warn('Failed to fetch Vertex credits', error);
    }

    return { entry, credits };
}

export async function requestVertexReputation(
    ndk: NDK,
    targetPubkey: Hexpubkey,
    sourcePubkey: Hexpubkey,
    timeoutMs = VERTEX_REPUTATION_TIMEOUT_MS
): Promise<VertexReputationCacheEntry> {
    const response = await requestVertexReputationWithCredits(
        ndk,
        targetPubkey,
        sourcePubkey,
        timeoutMs
    );

    return response.entry;
}
