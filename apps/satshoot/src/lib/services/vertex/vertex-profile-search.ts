import type NDK from '@nostr-dev-kit/ndk';
import {
    NDKEvent,
    NDKKind,
    NDKRelaySet,
    NDKSubscriptionCacheUsage,
    type Hexpubkey,
    type NDKSubscription,
} from '@nostr-dev-kit/ndk';

export const VERTEX_RELAY_URL = 'wss://relay.vertexlab.io';

export const VERTEX_PROFILE_SEARCH_REQUEST_KIND = 5315;
export const VERTEX_PROFILE_SEARCH_RESPONSE_KIND = 6315;
export const VERTEX_PROFILE_SEARCH_ERROR_KIND = 7000;

export const VERTEX_PROFILE_SEARCH_SORT = 'globalPagerank';
export const VERTEX_PROFILE_SEARCH_LIMIT = 5;
export const VERTEX_PROFILE_SEARCH_MIN_LENGTH = 4;
export const VERTEX_PROFILE_SEARCH_TIMEOUT_MS = 8000;

export interface VertexProfileSearchEntry {
    pubkey: Hexpubkey;
    rank: number;
}

const getVertexErrorMessage = (event: NDKEvent): string => {
    const statusTag = event.tags.find((tag) => tag[0] === 'status');

    if (statusTag?.[2]) {
        return statusTag[2];
    }

    if (statusTag?.[1]) {
        return statusTag[1];
    }

    return 'Vertex returned an unknown error.';
};

const parseVertexProfileSearchResponse = (event: NDKEvent, limit: number): VertexProfileSearchEntry[] => {
    let parsed: VertexProfileSearchEntry[];

    try {
        parsed = JSON.parse(event.content) as VertexProfileSearchEntry[];
    } catch (error) {
        throw new Error('Vertex response could not be parsed.');
    }

    if (!Array.isArray(parsed)) {
        throw new Error('Vertex response could not be parsed.');
    }

    return parsed.slice(0, limit);
};

const waitForVertexProfileSearchResponse = (
    ndk: NDK,
    relaySet: NDKRelaySet,
    requestId: string,
    timeoutMs: number
): Promise<NDKEvent> =>
    new Promise((resolve, reject) => {
        const subscription: NDKSubscription = ndk.subscribe(
            {
                kinds: [VERTEX_PROFILE_SEARCH_RESPONSE_KIND as NDKKind, VERTEX_PROFILE_SEARCH_ERROR_KIND as NDKKind],
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

export async function requestVertexProfileSearch(
    ndk: NDK,
    search: string,
    sourcePubkey: Hexpubkey,
    opts: {
        limit?: number;
        sort?: string;
        timeoutMs?: number;
    } = {}
): Promise<VertexProfileSearchEntry[]> {
    const trimmedSearch = search.trim();

    if (trimmedSearch.length < VERTEX_PROFILE_SEARCH_MIN_LENGTH) {
        return [];
    }

    const limit = opts.limit ?? VERTEX_PROFILE_SEARCH_LIMIT;
    const sort = opts.sort ?? VERTEX_PROFILE_SEARCH_SORT;
    const timeoutMs = opts.timeoutMs ?? VERTEX_PROFILE_SEARCH_TIMEOUT_MS;

    const relaySet = NDKRelaySet.fromRelayUrls([VERTEX_RELAY_URL], ndk, true);

    const request = new NDKEvent(ndk);
    request.kind = VERTEX_PROFILE_SEARCH_REQUEST_KIND;
    request.content = '';
    request.tags.push(['param', 'search', trimmedSearch]);
    request.tags.push(['param', 'sort', sort]);
    request.tags.push(['param', 'source', sourcePubkey]);
    request.tags.push(['param', 'limit', limit.toString()]);

    await request.publish(relaySet);

    const response = await waitForVertexProfileSearchResponse(ndk, relaySet, request.id, timeoutMs);

    if (response.kind === VERTEX_PROFILE_SEARCH_ERROR_KIND) {
        throw new Error(getVertexErrorMessage(response));
    }

    if (response.kind !== VERTEX_PROFILE_SEARCH_RESPONSE_KIND) {
        throw new Error('Vertex returned an unexpected response.');
    }

    return parseVertexProfileSearchResponse(response, limit);
}
