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

type PubkeyToRelaysMap = Map<Hexpubkey, Set<WebSocket['url']>>;

function getTopRelays(pubkeyToRelaysMap: PubkeyToRelaysMap, limit = 10): WebSocket['url'][] {
    const relaysWithCount = new Map<WebSocket['url'], number>();

    pubkeyToRelaysMap.forEach((relays, pubkey) => {
        relays.forEach((relay) => {
            const count = relaysWithCount.get(relay) || 0;
            relaysWithCount.set(relay, count + 1);
        });
    });

    /**
     * TODO: Here we are sorting the relays just by number of authors that write to them.
     * Here is the place where the relay scoring can be used to modify the weights of the relays.
     */

    // Sort the relays by the number of authors that write to them
    const sortedRelays = Array.from(relaysWithCount.entries()).sort((a, b) => b[1] - a[1]);

    console.log('sortedRelays', sortedRelays);

    return sortedRelays.slice(0, limit).map((entry) => entry[0]);
}

async function getRelayListForUsersBatch(pubkeys: Hexpubkey[], ndk: NDK, timeoutMs = 5000) {
    const pool = ndk.outboxPool || ndk.pool;
    const set = new Set<NDKRelay>();

    for (const relay of pool.relays.values()) set.add(relay);

    const relayLists = new Map<Hexpubkey, NDKRelayList>();

    // if we have no pubkeys, return the results
    if (pubkeys.length === 0) return relayLists;

    const relaySet = new NDKRelaySet(set, ndk);

    // Log relay set info
    const connectedRelays = Array.from(set).filter(
        (relay) => relay.status === NDKRelayStatus.CONNECTED
    );
    console.log(`Relay set connected: ${connectedRelays.length}/${set.size}`);

    try {
        // Fetch with timeout
        const events = await Promise.race([
            ndk.fetchEvents(
                { kinds: [NDKKind.RelayList], authors: Array.from(new Set(pubkeys)) },
                { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST, relaySet }
            ),
            new Promise<Set<any>>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
            ),
        ]);

        console.log(`Fetched ${events.size} relay list events for ${pubkeys.length} pubkeys`);

        // process the events
        for (const event of events) {
            relayLists.set(event.pubkey, NDKRelayList.from(event));
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('Timeout')) {
            console.warn(`Relay list fetch timed out after ${timeoutMs}ms`);
        } else {
            console.error('Error fetching relay lists:', error);
        }
        // Return partial results (empty map) instead of throwing
    }

    return relayLists;
}

export async function calculateRelaySet(pubkeys: Hexpubkey[], ndk: NDK) {
    const pubkeyToRelaysMap = new Map<Hexpubkey, Set<WebSocket['url']>>();
    const BATCH_SIZE = 1000;

    // Ensure NDK is connected to relays
    console.log('Waiting for NDK to connect to relays...');
    await ndk.connect(5000);

    console.log(`Connected relays: ${ndk.outboxPool?.connectedRelays().length}`);

    for (let i = 0; i < pubkeys.length; i += BATCH_SIZE) {
        const batch = pubkeys.slice(i, i + BATCH_SIZE);
        console.log(
            `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
                pubkeys.length / BATCH_SIZE
            )} (${batch.length} pubkeys)`
        );

        try {
            const relayListsMap = await getRelayListForUsersBatch(batch, ndk);

            // Process the results
            relayListsMap.forEach((relayList, pubkey) => {
                if (relayList && relayList.writeRelayUrls.length > 0) {
                    pubkeyToRelaysMap.set(pubkey, new Set(relayList.writeRelayUrls));
                }
            });

            console.log(
                `Batch ${Math.floor(i / BATCH_SIZE) + 1}: Found relays for ${
                    relayListsMap.size
                } users`
            );
        } catch (error) {
            console.error(`Error fetching relay lists for batch:`, error);
        }

        // Small delay between batches to avoid overwhelming relays
        if (i + BATCH_SIZE < pubkeys.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    console.log(`Collected write relays for ${pubkeyToRelaysMap.size}/${pubkeys.length} pubkeys`);

    return getTopRelays(pubkeyToRelaysMap);
}
