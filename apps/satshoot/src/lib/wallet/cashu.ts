import NDK, {
  NDKKind,
  NDKRelaySet,
  NDKSubscriptionCacheUsage,
  type Hexpubkey,
  type NDKEvent,
  type NDKFilter,
} from '@nostr-dev-kit/ndk';
import {
  type MintUrl,
  type MintUsage,
} from '@nostr-dev-kit/ndk-wallet';

const RECOMMENDATION_FETCH_TIMEOUT_MS = 5000;

type MintEndorsementType = 'explicit' | 'nutzap';

export type MintEndorsementTypes = {
  explicit: boolean;
  nutzap: boolean;
};

export type MintRecommendationUsage = MintUsage & {
  endorsementsByPubkey: Map<Hexpubkey, MintEndorsementTypes>;
};

export type CashuMintRecommendations = Record<MintUrl, MintRecommendationUsage>;

export async function getCashuMintRecommendations(
  ndk: NDK,
  $wot: Set<string>
): Promise<CashuMintRecommendations> {
  const res: CashuMintRecommendations = {};

  const mintFilters: NDKFilter[] = [
    { kinds: [NDKKind.EcashMintRecommendation] },
    { kinds: [NDKKind.CashuMintList] },
  ];

  const relaySet = getConnectedRelaySet(ndk);
  const mintRecommendations = await fetchEventsWithTimeout(
    ndk.fetchEvents(
      mintFilters,
      {
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        closeOnEose: true,
        groupable: false,
      },
      relaySet
    ),
    RECOMMENDATION_FETCH_TIMEOUT_MS
  );

  for (const event of mintRecommendations) {
    if (!$wot.has(event.pubkey)) continue;

    switch (event.kind) {
      case NDKKind.CashuMintList:
        for (const mintTag of event.getMatchingTags('mint')) {
          const url = mintTag[1];
          if (!url) continue;

          registerEndorsement(res, url, event, 'nutzap');
        }
        break;
      case NDKKind.EcashMintRecommendation:
        for (const uTag of event.getMatchingTags('u')) {
          if (uTag[2] && uTag[2] !== 'cashu') continue;

          const url = uTag[1];
          if (!url) continue;

          registerEndorsement(res, url, event, 'explicit');
        }
        break;
    }
  }

  return sortRecommendations(res);
}

function registerEndorsement(
  recommendations: CashuMintRecommendations,
  url: MintUrl,
  event: NDKEvent,
  endorsementType: MintEndorsementType
) {
  const entry = recommendations[url] || {
    events: [],
    pubkeys: new Set<Hexpubkey>(),
    endorsementsByPubkey: new Map<Hexpubkey, MintEndorsementTypes>(),
  };

  entry.events.push(event);
  entry.pubkeys.add(event.pubkey);

  const current = entry.endorsementsByPubkey.get(event.pubkey) || {
    explicit: false,
    nutzap: false,
  };

  if (endorsementType === 'explicit') {
    current.explicit = true;
  } else {
    current.nutzap = true;
  }

  entry.endorsementsByPubkey.set(event.pubkey, current);
  recommendations[url] = entry;
}

async function fetchEventsWithTimeout(
  promise: Promise<Set<NDKEvent>>,
  timeoutMs: number
): Promise<Set<NDKEvent>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<Set<NDKEvent>>((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      resolve(new Set());
    }, timeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);

  if (timeoutId) clearTimeout(timeoutId);

  if (timedOut) {
    console.warn(`Cashu mint recommendation fetch timed out after ${timeoutMs}ms.`);
  }

  return result;
}

function getConnectedRelaySet(ndk: NDK) {
  const relays = Array.from(ndk.pool?.relays?.values() ?? []);
  const relayUrls = relays
    .filter((relay) => ('connected' in relay ? relay.connected : true))
    .map((relay) => relay.url);

  if (relayUrls.length === 0) return undefined;

  return NDKRelaySet.fromRelayUrls(relayUrls, ndk);
}

// Helper function to sort recommendations by the count of unique pubkeys
function sortRecommendations(recommendations: CashuMintRecommendations) {
  return Object.fromEntries(
    Object.entries(recommendations).sort((a, b) => b[1].pubkeys.size - a[1].pubkeys.size)
  );
}
