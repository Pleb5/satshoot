import { dev } from '$app/environment';
import {
    NDKKind,
    NDKRelayList,
    NDKRelaySet,
    NDKRelayStatus,
    NDKSubscriptionCacheUsage,
    type Hexpubkey,
    type NDKRelay,
} from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';

type RelayCountsMap = Map<WebSocket['url'], number>;
type RelayListSnapshot = {
    createdAt: number;
    relayUrls: Set<WebSocket['url']>;
};
type RelayListBatch = Map<Hexpubkey, RelayListSnapshot>;
type RelayListCollectResult = {
    eventCount: number;
    timedOut: boolean;
};

function getTopRelays(relayCounts: RelayCountsMap, limit = 10): WebSocket['url'][] {
    const sortedRelays = Array.from(relayCounts.entries()).sort((a, b) => b[1] - a[1]);

    /**
     * TODO: Here we are sorting the relays just by number of authors that write to them.
     * Here is the place where the relay scoring can be used to modify the weights of the relays.
     */

    if (dev) {
        console.log('sortedRelays', sortedRelays.slice(0, limit));
    }

    return sortedRelays.slice(0, limit).map((entry) => entry[0]);
}

function getDeviceMemoryGb(): number | undefined {
    if (typeof navigator === 'undefined') return undefined;

    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

    if (typeof deviceMemory !== 'number') return undefined;

    return deviceMemory;
}

function resolveBatchSize(totalPubkeys: number): number {
    const DEFAULT_BATCH_SIZE = 600;
    const MIN_BATCH_SIZE = 200;
    const MAX_BATCH_SIZE = 1000;

    const deviceMemory = getDeviceMemoryGb();
    let batchSize = DEFAULT_BATCH_SIZE;

    if (deviceMemory !== undefined) {
        if (deviceMemory <= 2) {
            batchSize = 250;
        } else if (deviceMemory <= 4) {
            batchSize = 400;
        } else if (deviceMemory >= 8) {
            batchSize = MAX_BATCH_SIZE;
        }
    }

    batchSize = Math.min(MAX_BATCH_SIZE, Math.max(MIN_BATCH_SIZE, batchSize));

    if (totalPubkeys > 0) {
        batchSize = Math.min(batchSize, totalPubkeys);
    }

    return batchSize;
}

function updateRelayListSnapshot(
    relayLists: RelayListBatch,
    pubkey: Hexpubkey,
    createdAt: number,
    relayUrls: string[]
): void {
    const existing = relayLists.get(pubkey);
    if (existing && existing.createdAt >= createdAt) return;

    const sanitizedRelays = relayUrls
        .map((relay) => relay.trim())
        .filter((relay) => relay.length > 0);

    relayLists.set(pubkey, {
        createdAt,
        relayUrls: new Set(sanitizedRelays),
    });
}

async function collectRelayLists(
    relayLists: RelayListBatch,
    authors: Hexpubkey[],
    ndk: NDK,
    opts: {
        cacheUsage: NDKSubscriptionCacheUsage;
        timeoutMs: number;
        relaySet?: NDKRelaySet;
    }
): Promise<RelayListCollectResult> {
    let eventCount = 0;
    let timedOut = false;

    if (authors.length === 0) {
        return { eventCount, timedOut };
    }

    try {
        await new Promise<void>((resolve) => {
            let finished = false;
            let timeoutId: ReturnType<typeof setTimeout>;

            const subscription = ndk.subscribe(
                { kinds: [NDKKind.RelayList], authors },
                {
                    cacheUsage: opts.cacheUsage,
                    closeOnEose: true,
                    groupable: false,
                    relaySet: opts.relaySet,
                }
            );

            const finalize = (didTimeout: boolean) => {
                if (finished) return;
                finished = true;
                timedOut = didTimeout;
                clearTimeout(timeoutId);
                subscription.stop();
                resolve();
            };

            timeoutId = setTimeout(() => finalize(true), opts.timeoutMs);

            subscription.on('event', (event) => {
                eventCount += 1;

                const createdAt = event.created_at ?? 0;

                try {
                    const relayList = NDKRelayList.from(event);
                    updateRelayListSnapshot(
                        relayLists,
                        event.pubkey as Hexpubkey,
                        createdAt,
                        relayList.writeRelayUrls
                    );
                } catch (error) {
                    console.warn('Failed to parse relay list event:', error);
                }
            });

            subscription.on('eose', () => finalize(false));
        });
    } catch (error) {
        console.error('Error fetching relay lists:', error);
    }

    return { eventCount, timedOut };
}

async function getRelayListForUsersBatch(
    pubkeys: Hexpubkey[],
    ndk: NDK,
    timeoutMs = 5000
): Promise<RelayListBatch> {
    const relayLists: RelayListBatch = new Map();

    if (pubkeys.length === 0) return relayLists;

    const authors = Array.from(new Set(pubkeys));
    const cacheResult = await collectRelayLists(relayLists, authors, ndk, {
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE,
        timeoutMs: 1500,
    });

    const missingAuthors = authors.filter((author) => !relayLists.has(author));

    if (dev) {
        console.log(
            `Relay list cache hits: ${authors.length - missingAuthors.length}/${authors.length} ` +
                `(events: ${cacheResult.eventCount})`
        );
    }

    if (missingAuthors.length === 0) {
        return relayLists;
    }

    const pool = ndk.outboxPool || ndk.pool;

    if (!pool) {
        console.warn('No relay pool available for relay list fetch.');
        return relayLists;
    }

    const set = new Set<NDKRelay>();

    for (const relay of pool.relays.values()) set.add(relay);

    if (set.size === 0) {
        console.warn('No relays available for relay list fetch.');
        return relayLists;
    }

    const relaySet = new NDKRelaySet(set, ndk);

    if (dev) {
        const connectedRelays = Array.from(set).filter(
            (relay) => relay.status === NDKRelayStatus.CONNECTED
        );
        console.log(`Relay set connected: ${connectedRelays.length}/${set.size}`);
    }

    const relayResult = await collectRelayLists(relayLists, missingAuthors, ndk, {
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
        timeoutMs,
        relaySet,
    });

    if (dev) {
        console.log(
            `Fetched ${relayResult.eventCount} relay list events for ${missingAuthors.length} pubkeys`
        );
    }

    if (relayResult.timedOut) {
        console.warn(`Relay list fetch timed out after ${timeoutMs}ms`);
    }

    return relayLists;
}

function addRelayCounts(relayCounts: RelayCountsMap, relayListsMap: RelayListBatch): number {
    let usersWithRelays = 0;

    relayListsMap.forEach((relayList) => {
        if (relayList.relayUrls.size === 0) return;
        usersWithRelays += 1;
        relayList.relayUrls.forEach((relay) => {
            const count = relayCounts.get(relay) || 0;
            relayCounts.set(relay, count + 1);
        });
    });

    return usersWithRelays;
}

interface ProgressCallback {
    fetchedUsers: number;
    currentBatch: number;
    totalBatches: number;
}

export async function calculateRelaySet(
    pubkeys: Hexpubkey[],
    ndk: NDK,
    onProgress?: (progress: ProgressCallback) => void
) {
    if (pubkeys.length === 0) return [];

    const relayCounts: RelayCountsMap = new Map();
    const batchSize = resolveBatchSize(pubkeys.length);

    // Ensure NDK is connected to relays
    if (dev) {
        console.log('Waiting for NDK to connect to relays...');
    }
    await ndk.connect(5000);

    if (dev) {
        console.log(`Connected relays: ${ndk.outboxPool?.connectedRelays().length}`);
    }

    const totalBatches = Math.ceil(pubkeys.length / batchSize);
    let totalFetchedUsers = 0;

    for (let i = 0; i < pubkeys.length; i += batchSize) {
        const batch = pubkeys.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;

        if (dev) {
            console.log(
                `Processing batch ${currentBatch}/${totalBatches} (${batch.length} pubkeys)`
            );
        }

        try {
            const relayListsMap = await getRelayListForUsersBatch(batch, ndk);
            const usersWithRelays = addRelayCounts(relayCounts, relayListsMap);

            totalFetchedUsers += usersWithRelays;

            if (dev) {
                console.log(
                    `Batch ${currentBatch}: Found relays for ${usersWithRelays} users ` +
                        `(total: ${totalFetchedUsers})`
                );
            }

            relayListsMap.clear();

            // Report progress
            if (onProgress) {
                onProgress({
                    fetchedUsers: totalFetchedUsers,
                    currentBatch,
                    totalBatches,
                });
            }
        } catch (error) {
            console.error(`Error fetching relay lists for batch:`, error);
        }

        // Small delay between batches to avoid overwhelming relays
        if (i + batchSize < pubkeys.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    if (dev) {
        console.log(`Collected write relays for ${totalFetchedUsers}/${pubkeys.length} pubkeys`);
    }

    return getTopRelays(relayCounts);
}
