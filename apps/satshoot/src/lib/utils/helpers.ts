import {
  NDKEvent,
  type NDKSigner,
  NDKKind,
  NDKRelayList,
  NDKSubscriptionCacheUsage,
  profileFromEvent,
  getNip57ZapSpecFromLud,
  NDKRelaySet,
  NDKCashuMintList,
  type CashuPaymentInfo,
  serializeProfile,
  NDKUser,
  NDKList,
  NDKRelay,
  type NDKFilter,
  type NDKLnUrlData,
  NDKNip46Signer,
} from '@nostr-dev-kit/ndk';
import ndk, {
  blastrUrl,
  BOOTSTRAPOUTBOXRELAYS,
  DEFAULTRELAYURLS,
  sessionPK,
} from '$lib/stores/session';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import currentUser, { freelanceFollowSets, onBoarding } from '../stores/user';
import { loggedIn, loggingIn, loginMethod, followsUpdated } from '../stores/user';
import { loadWot, myMuteList, myMuteListFilter, networkWoTScores } from '../stores/wot';
import { allReviews } from '$lib/stores/reviews';
import { allReceivedZapsFilter, allReceivedZaps } from '$lib/stores/zaps';
import { messageStore, sentMessageFilter, receivedMessageFilter } from '$lib/stores/messages';
import {
  allJobs,
  allBids,
  myJobFilter,
  myBidFilter,
  myJobs,
  myBids,
  myServiceFilter,
  myOrderFilter,
  allServices,
  allOrders,
  myServices,
  myOrders,
} from '$lib/stores/freelance-eventstores';
import { notifications, seenIDs, serviceWorkerRegistrationFailed } from '../stores/notifications';
import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { dev } from '$app/environment';
import { connected } from '../stores/network';
import { retriesLeft, retryDelay, maxRetryAttempts } from '../stores/network';
import {
  ndkNutzapMonitor,
  userCashuInfo,
  wallet,
  walletDecryptFailed,
  walletInit,
  walletStatus,
} from '$lib/wallet/wallet';
import {
  DeterministicCashuWalletInfoKind,
  NDKCashuWallet,
  NDKWalletStatus,
} from '@nostr-dev-kit/ndk-wallet';
import { fetchEventFromRelaysFirst, APP_RELAY_STORAGE_KEY } from '$lib/utils/misc';
import { toaster } from '$lib/stores/toaster';

export async function initializeUser(ndk: NDKSvelte) {
  console.log('begin user init');
  try {
    loggingIn.set(false);

    const user = await (ndk.signer as NDKSigner).user();
    if (user.npub) {
      loggedIn.set(true);
    } else return;

    currentUser.set(user);

    myJobFilter.authors = [user.pubkey];
    myBidFilter.authors = [user.pubkey];
    myServiceFilter.authors = [user.pubkey];
    myOrderFilter.authors = [user.pubkey];

    myMuteListFilter.authors = [user.pubkey];

    const $onboarding = get(onBoarding);
    if (!$onboarding) {
      fetchAndInitWallet(user, ndk).catch((error) => {
        console.warn('Wallet init failed during user initialization.', error);
      });

      await loadWot(ndk, user);
    }

    myMuteList.startSubscription();

    myJobs.startSubscription();
    myBids.startSubscription();
    myServices.startSubscription();
    myOrders.startSubscription();

    allJobs.startSubscription();
    allBids.startSubscription();
    allServices.startSubscription();
    allOrders.startSubscription();

    receivedMessageFilter['#p']! = [user.pubkey];
    sentMessageFilter['authors'] = [user.pubkey];
    allReceivedZapsFilter['#p']! = [user.pubkey];

    // Start message and review subs after successful wot and follow recalc
    messageStore.startSubscription();
    allReviews.startSubscription();
    allReceivedZaps.startSubscription();
  } catch (e) {
    console.log('Could not initialize User. Reason: ', e);
  }
}

const WALLET_DECRYPT_TIMEOUT_MS = 2000;
const WALLET_DECRYPT_TIMEOUT_REMOTE_MS = 5000;
const WALLET_INIT_TIMEOUT = 5000;
let walletDecryptToastShownGlobal = false;
const WALLET_INIT_LOG_PREFIX = "[wallet:init]";

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<undefined>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`${label} timed out after ${timeoutMs}ms.`);
        resolve(undefined);
      }, timeoutMs);
    });

    return (await Promise.race([promise, timeoutPromise])) as T | undefined;
  } catch (error) {
    console.warn(`${label} failed.`, error);
    return undefined;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function sortEventsByCreatedAtDesc(events: NDKEvent[]): NDKEvent[] {
  return events.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
}

function filterMalformedCashuEvents(events: Set<NDKEvent>) {
  for (const event of events) {
    const validEvent = event.validate()
    const validSig = event.verifySignature(false)

    if (!validEvent || !validSig) events.delete(event)
  }
}

function getDecryptTimeoutMs(ndk: NDKSvelte): number {
  return ndk.signer instanceof NDKNip46Signer
    ? WALLET_DECRYPT_TIMEOUT_REMOTE_MS
    : WALLET_DECRYPT_TIMEOUT_MS;
}

async function fetchCashuEventsFromRelays(
  ndk: NDKSvelte,
  filter: NDKFilter,
  relayUrls: string[]
) {

  try {
    const relaySet = NDKRelaySet.fromRelayUrls(relayUrls, ndk);
    const events = await ndk.fetchEvents(
      filter,
      { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY, relaySet }
    )

    return events

  } catch (error) {
    console.warn(`Error while fetching cashu wallet events`, error);
    return new Set<NDKEvent>();
  }
}

export async function fetchAndInitWallet(
  user: NDKUser,
  ndk: NDKSvelte,
) {
  const initPubkey = user.pubkey;
  const isStale = () => {
    const activeUser = get(currentUser);
    return !activeUser || activeUser.pubkey !== initPubkey;
  };

  if (isStale()) return;

  walletDecryptFailed.set(false);

  walletStatus.set(NDKWalletStatus.LOADING);
  try {
    console.warn(`${WALLET_INIT_LOG_PREFIX} Start`, {
      pubkey: user.pubkey,
      signerType: ndk.signer?.constructor?.name ?? 'unknown',
      signerEncryption: await ndk.signer?.encryptionEnabled?.(),
    });

    let walletRelays = DEFAULTRELAYURLS;
    let userOutboxRelays: string[] = [];

    const userRelays = await fetchUserOutboxRelays(ndk, user.pubkey, 2000);
    if (isStale()) return;
    if (userRelays) {
      userOutboxRelays = NDKRelayList.from(userRelays).writeRelayUrls;
      walletRelays = [...walletRelays, ...userOutboxRelays];
    }
    console.warn(`${WALLET_INIT_LOG_PREFIX} Resolved relays`, {
      userOutboxRelays,
      walletRelays,
    });

    const kindsArr = [
      NDKKind.CashuWallet,
      NDKKind.CashuMintList,
      DeterministicCashuWalletInfoKind,
    ];

    const filter = {
      kinds: kindsArr,
      authors: [user.pubkey],
    };

    const cashuEvents = await fetchCashuEventsFromRelays(ndk, filter, walletRelays);
    if (isStale()) return;

    filterMalformedCashuEvents(cashuEvents);

    console.warn(`${WALLET_INIT_LOG_PREFIX} Cashu events loaded`, {
      count: cashuEvents.size,
      events: cashuEvents,
    });

    const eventsByKind = new Map<number, NDKEvent[]>();
    for (const event of cashuEvents) {
      const existing = eventsByKind.get(event.kind) ?? [];
      existing.push(event);
      eventsByKind.set(event.kind, existing);
    }

    const cashuWalletEvents = sortEventsByCreatedAtDesc(
      [...(eventsByKind.get(NDKKind.CashuWallet) ?? [])]
    );
    const deterministicWalletEvents = sortEventsByCreatedAtDesc(
      [...(eventsByKind.get(DeterministicCashuWalletInfoKind) ?? [])]
    );
    const mintListEvents = sortEventsByCreatedAtDesc(
      [...(eventsByKind.get(NDKKind.CashuMintList) ?? [])]
    );

    const cashuWalletEvent = cashuWalletEvents[0];
    const deterministicWalletEvent = deterministicWalletEvents[0];
    const cashuMintListEvent = mintListEvents[0];
    const cashuMintList = cashuMintListEvent
      ? NDKCashuMintList.from(cashuMintListEvent)
      : undefined;

    if (isStale()) return;

    if (!cashuMintList) {
      if (!cashuWalletEvent && !deterministicWalletEvent) {
        walletStatus.set(NDKWalletStatus.FAILED)
        return
      }
      toaster.error({
        title: 'Could not fetch Cashu mint list',
      });
      walletStatus.set(NDKWalletStatus.FAILED)
      return
    }

    if (!cashuWalletEvent) {
      toaster.error({
        title: 'Could not fetch Cashu wallet event',
      });
      walletStatus.set(NDKWalletStatus.FAILED);
      return;
    }

    const decryptTimeoutMs = getDecryptTimeoutMs(ndk);

    console.warn(`${WALLET_INIT_LOG_PREFIX} Deterministic event selected`, {
      hasEvent: Boolean(deterministicWalletEvent),
      latestCreatedAt: deterministicWalletEvent?.created_at ?? 0,
      timeoutMs: decryptTimeoutMs,
    });


    console.warn('Start deterministic info decryption: ')

    let decryptedDeterministicInfo: string | undefined;
    if (deterministicWalletEvent && ndk.signer) {
      decryptedDeterministicInfo = await withTimeout(
        deterministicWalletEvent.decrypt().then(() => deterministicWalletEvent.content),
        5000,
        `Deterministic wallet decrypt`
      );
    }
    if (isStale()) return;

    if (deterministicWalletEvent && !decryptedDeterministicInfo) {
      console.warn(`${WALLET_INIT_LOG_PREFIX} Deterministic Decrypt failed`, {
      });
      if (!walletDecryptToastShownGlobal) {
        walletDecryptToastShownGlobal = true;
        toaster.error({
          title: 'Could not decrypt deterministic info. Check your signer connection.',
        });
      }
      walletDecryptFailed.set(true)
      console.warn(`${WALLET_INIT_LOG_PREFIX} Continuing without deterministic info`);
    }

    console.warn(`${WALLET_INIT_LOG_PREFIX} Deterministic Decrypt success`, {
    });


    let directDecrypt: string | undefined;
    if (ndk.signer) {
      directDecrypt = await withTimeout(
        ndk.signer.decrypt(
          ndk.getUser({ pubkey: cashuWalletEvent.pubkey }),
          cashuWalletEvent.content,
          'nip44'
        ),
        decryptTimeoutMs,
        `Cashu wallet decrypt`
      );
    }
    if (isStale()) return;

    if (!directDecrypt) {
      console.warn(`${WALLET_INIT_LOG_PREFIX} Decrypt failed`, {
        kind: cashuWalletEvent.kind,
        pubkey: cashuWalletEvent.pubkey,
      });
      if (!walletDecryptToastShownGlobal) {
        walletDecryptToastShownGlobal = true;
        toaster.error({
          title: 'Could not decrypt wallet. Check your signer connection.',
        });
      }
      walletDecryptFailed.set(true)
      walletStatus.set(NDKWalletStatus.FAILED);
      return
    }

    console.warn(`${WALLET_INIT_LOG_PREFIX} Decrypt success`, {
      kind: cashuWalletEvent.kind,
      pubkey: cashuWalletEvent.pubkey,
    });


    const walletFromEvent = await NDKCashuWallet.from(
      cashuWalletEvent,
      deterministicWalletEvent,
      directDecrypt,
      decryptedDeterministicInfo
    );
    if (isStale()) return;

    if (!walletFromEvent) {
      toaster.error({
        title: 'Wallet corrupted! Try to create a new one.',
      });
      walletStatus.set(NDKWalletStatus.FAILED);
      return
    }

    console.warn(`${WALLET_INIT_LOG_PREFIX} Wallet constructed`, {
      kind: cashuWalletEvent.kind,
      pubkey: cashuWalletEvent.pubkey,
    });

    console.warn(`${WALLET_INIT_LOG_PREFIX} Wallet init start`, {
    });

    const initiated = await withTimeout(
      walletInit(walletFromEvent, cashuMintList, ndk, user),
      WALLET_INIT_TIMEOUT,
      "Wallet init"
    )
    if (isStale()) return;
    if (initiated) {
      walletStatus.set(NDKWalletStatus.READY);
    } else {
      walletStatus.set(NDKWalletStatus.FAILED)
    }
  } catch (error) {
    if (!isStale()) {
      console.warn(`${WALLET_INIT_LOG_PREFIX} Wallet init failed`, error);
      walletStatus.set(NDKWalletStatus.FAILED);
    }
  }
}

export function logout() {
  console.log('logout');

  loginMethod.set(null);

  loggedIn.set(false);
  loggingIn.set(false);

  followsUpdated.set(0);
  networkWoTScores.set(new Map());

  currentUser.set(null);

  // We dont remove modeCurrent(dark/light theme), debug and app_updated_at entries
  localStorage.removeItem('followsUpdated');
  localStorage.removeItem('tabStore');
  localStorage.removeItem('jobTabStore');
  localStorage.removeItem('bidTabStore');
  localStorage.removeItem('notificationsEnabled');
  localStorage.removeItem('serviceWorkerRegFailed');
  localStorage.removeItem('useSatShootWoT');
  localStorage.removeItem('networkWoTScores');
  localStorage.removeItem('seenIDs');
  localStorage.removeItem('nostr-npub');
  localStorage.removeItem('nostr-nsec');
  localStorage.removeItem('pk');
  localStorage.removeItem('nip46SignerPayload');
  localStorage.removeItem('nostrConnectLocalSigner');
  localStorage.removeItem('nostrConnectRemotePubkey');
  localStorage.removeItem('readNotifications');
  localStorage.removeItem('jobFilter');
  localStorage.removeItem('bidFilter');
  localStorage.removeItem(APP_RELAY_STORAGE_KEY);

  sessionStorage.clear();

  sessionPK.set('');

  seenIDs.set(new Set());

  myJobs.empty();
  myBids.empty();
  myServices.empty();
  myOrders.empty();

  myJobFilter.authors = [];
  myBidFilter.authors = [];
  myServiceFilter.authors = [];
  myOrderFilter.authors = [];

  allJobs.empty();
  allBids.empty();
  allServices.empty();
  allOrders.empty();

  messageStore.empty();
  allReviews.empty();
  allReceivedZaps.empty();

  notifications.set([]);

  wallet.set(null);
  userCashuInfo.set(null);
  walletStatus.set(NDKWalletStatus.INITIAL);
  walletDecryptFailed.set(false);
  walletDecryptToastShownGlobal = false;

  if (ndkNutzapMonitor) {
    ndkNutzapMonitor.stop();
  }

  get(ndk).signer = undefined;

  goto('/');
}

export async function freelanceFollow(pubkey: string) {
  const $currentUser = get(currentUser);
  if (!$currentUser) return;

  let followSet = get(freelanceFollowSets).get($currentUser.pubkey);

  if (!followSet) {
    followSet = new NDKList(get(ndk));
    followSet.kind = NDKKind.FollowSet;
    followSet.tag(['d', 'freelance']);
  }

  followSet.tag(['p', pubkey]);

  await followSet
    .publishReplaceable()
    .then(() => {
      toaster.success({
        title: 'Followed!',
      });

      freelanceFollowSets.update((map) => {
        map.set($currentUser.pubkey, followSet);
        return map;
      });
    })
    .catch((err) => {
      console.error(err);
      toaster.error({
        title: 'Failed to publish follow set',
      });
    });
}

export async function freelanceUnfollow(pubkey: string) {
  const $currentUser = get(currentUser);

  if (!$currentUser) return;

  const followSet = get(freelanceFollowSets).get($currentUser.pubkey);

  if (!followSet) return;

  followSet.removeItemByValue(pubkey);

  await followSet
    .publishReplaceable()
    .then(() => {
      toaster.success({
        title: 'Un-followed!',
      });

      freelanceFollowSets.update((map) => {
        map.set($currentUser.pubkey, followSet);
        return map;
      });
    })
    .catch((err) => {
      console.error(err);
      toaster.error({
        title: 'Failed to publish follow set',
      });
    });
}

export async function getActiveServiceWorker(): Promise<ServiceWorker | null> {
  // Early return if we've already determined that registration has failed
  if (get(serviceWorkerRegistrationFailed)) {
    return null;
  }

  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers are not supported in this browser');
    serviceWorkerRegistrationFailed.set(true);
    return null;
  }

  try {
    // Get existing registration
    let registeredSW = await navigator.serviceWorker.getRegistration();

    // If no registration exists, try to register
    if (!registeredSW) {
      console.log('No registered Service Worker, attempting to register...');
      try {
        registeredSW = await navigator.serviceWorker.register('/service-worker.js', {
          type: dev ? 'module' : 'classic',
        });
      } catch (error) {
        console.error('Service worker registration failed:', error);
        serviceWorkerRegistrationFailed.set(true);
        return null;
      }
    }

    // Check if there's an active service worker
    if (registeredSW.active) {
      console.log('Found active service worker');
      return registeredSW.active;
    }

    // At this point we have a registration but no active service worker yet
    console.log('Service worker is registered but not yet active');

    // Instead of waiting, we'll mark this as "not failed" but return null
    // This avoids repeated registration attempts and correctly handles the
    // case where the service worker is still installing/waiting
    return null;
  } catch (error) {
    console.error('Error while handling service worker:', error);
    serviceWorkerRegistrationFailed.set(true);
    return null;
  }
}

export async function fetchUserOutboxRelays(
  ndk: NDKSvelte,
  pubkey: string,
  timeout: number = 4000
): Promise<NDKEvent | null> {
  const queryRelaysUrls = [...BOOTSTRAPOUTBOXRELAYS, ...DEFAULTRELAYURLS];

  const relayFilter = {
    kinds: [NDKKind.RelayList],
    authors: [pubkey],
  };

  let relays = await fetchEventFromRelaysFirst(ndk, relayFilter, {
    relayTimeoutMS: timeout,
    fallbackToCache: false,
    explicitRelays: queryRelaysUrls,
  });

  return relays;
}

export async function broadcastRelayList(
  ndk: NDKSvelte,
  readRelayUrls: string[],
  writeRelayUrls: string[]
) {
  const userRelayList = new NDKRelayList(ndk);
  userRelayList.readRelayUrls = Array.from(readRelayUrls);
  userRelayList.writeRelayUrls = Array.from(writeRelayUrls);

  const relaysPosted = await broadcastEvent(ndk, userRelayList, {
    explicitRelays: [...writeRelayUrls],
  });
  console.log('relays posted to:', relaysPosted);
}

export async function broadcastUserProfile(ndk: NDKSvelte, user: NDKUser) {
  if (!user.profile) {
    console.error('BUG: Cannot broadcast undefined profile!');
    return;
  }
  const ndkEvent = new NDKEvent(ndk);
  ndkEvent.content = serializeProfile(user.profile);
  ndkEvent.kind = NDKKind.Metadata;

  const explicitRelays: string[] = [...BOOTSTRAPOUTBOXRELAYS];

  const relayListEvent = await fetchUserOutboxRelays(ndk, user.pubkey);
  if (relayListEvent) {
    const relayList = NDKRelayList.from(relayListEvent);
    explicitRelays.push(...relayList.writeRelayUrls);
  }

  const relaysPosted = await broadcastEvent(ndk, ndkEvent, { explicitRelays });
  console.log('userProfile posted to:', relaysPosted);
}

export type BroadCastOpts = {
  explicitRelays?: string[];
  includePoolRelays?: boolean;
  includeOutboxPoolRelays?: boolean;
  includeBlastUrl?: boolean;
  replaceable?: boolean;
};
export async function broadcastEvent(
  ndk: NDKSvelte,
  ndkEvent: NDKEvent,
  broadCastOpts: BroadCastOpts = {
    explicitRelays: [],
    includePoolRelays: true,
    includeOutboxPoolRelays: true,
    includeBlastUrl: true,
    replaceable: false,
  }
) {
  const relayUrls = [...(broadCastOpts.explicitRelays ?? [])];

  if (broadCastOpts.includePoolRelays) {
    relayUrls.push(...ndk.pool.urls());
  }

  if (broadCastOpts.includeOutboxPoolRelays && ndk.outboxPool) {
    relayUrls.push(...ndk.outboxPool.urls());
  }

  if (broadCastOpts.includeBlastUrl) {
    relayUrls.push(blastrUrl);
  }

  const filteredRelays = relayUrls;

  if (!broadCastOpts.replaceable) {
    console.info('Broadcast event signing', {
      kind: ndkEvent.kind,
      pubkey: ndkEvent.pubkey,
      signerPubkey: await ndk.signer?.user()?.then((u) => u.pubkey),
    });
    const relays = await ndkEvent.publish(NDKRelaySet.fromRelayUrls(filteredRelays, ndk));
    console.info('Broadcast event published', {
      kind: ndkEvent.kind,
      relays: Array.from(relays).map((relay) => relay.url),
    });
    return relays;
  } else {
    console.info('Broadcast replaceable event signing', {
      kind: ndkEvent.kind,
      pubkey: ndkEvent.pubkey,
      signerPubkey: await ndk.signer?.user()?.then((u) => u.pubkey),
    });
    const relays = await ndkEvent.publishReplaceable(NDKRelaySet.fromRelayUrls(filteredRelays, ndk));
    console.info('Broadcast replaceable event published', {
      kind: ndkEvent.kind,
      relays: Array.from(relays).map((relay) => relay.url),
    });
    return relays;
  }
}

export async function checkRelayConnections(
  options: { forceReconnect?: boolean } = {}
) {
  const $ndk = get(ndk);
  const wasConnected = get(connected);

  const poolConnected = $ndk.pool?.stats().connected ?? 0;
  const outboxConnected = $ndk.outboxPool?.stats().connected ?? 0;
  const anyConnectedRelays = poolConnected + outboxConnected > 0;
  const forceReconnect = options.forceReconnect === true;

  console.log('Checking relay connections', {
    poolConnected,
    outboxConnected,
    forceReconnect,
  });

  if (forceReconnect) {
    retriesLeft.set(maxRetryAttempts);
  }

  if (!anyConnectedRelays || forceReconnect) {
    connected.set(false);
    let $retriesLeft = get(retriesLeft);
    if ($retriesLeft > 0) {
      $retriesLeft -= 1;
      retriesLeft.set($retriesLeft);
      // Try to reconnect to relays, timeout in 2sec for each relay
      $ndk.connect(retryDelay);
      // Re-check recursively when retry delay expires
      // This sets an explicit cap on retries.
      // After retryDelay X retriesLeft amount of time is elapsed
      // retry process is concluded and either we reconnected or
      // user needs to fix network and  possibly reload page
      setTimeout(() => checkRelayConnections(), retryDelay);
    }
  } else {
    // We are sufficiently connected
    connected.set(true);
    retriesLeft.set(maxRetryAttempts);
    if (!wasConnected) {
      restartCoreSubscriptions();
    }
  }
}

export async function forceRelayReconnect() {
  return checkRelayConnections({ forceReconnect: true });
}

function restartCoreSubscriptions() {
  const hasUser = Boolean(get(currentUser));

  if (hasUser) {
    myMuteList.startSubscription();
    myJobs.startSubscription();
    myBids.startSubscription();
    myServices.startSubscription();
    myOrders.startSubscription();
  }

  allJobs.startSubscription();
  allBids.startSubscription();
  allServices.startSubscription();
  allOrders.startSubscription();

  messageStore.startSubscription();
  allReviews.startSubscription();
  allReceivedZaps.startSubscription();
}

type ZapConfigFetchPolicy = 'relay-first' | 'cache-first' | 'relay-only';

type ZapConfigOptions = {
  fetchPolicy?: ZapConfigFetchPolicy;
  relayTimeoutMs?: number;
  onRevalidated?: (config: NDKLnUrlData | null) => void;
};

async function resolveZapSpecFromProfile(
  pubkey: string,
  profile: { lud06?: string; lud16?: string },
  ndkInstance: NDK
): Promise<NDKLnUrlData | null> {
  if (!profile.lud16) return null;

  try {
    const lnurlSpec = await getNip57ZapSpecFromLud(
      {
        lud06: profile.lud06,
        lud16: profile.lud16,
      },
      ndkInstance
    );

    return lnurlSpec ?? null;
  } catch (err) {
    console.error(`An error occurred in getZapConfiguration for ${pubkey}`, err);
    console.error('Try to parse lud06 as lud16 as last resort..');
    try {
      const lnurlSpec = await getNip57ZapSpecFromLud(
        { lud06: undefined, lud16: profile.lud06 },
        ndkInstance
      );

      return lnurlSpec ?? null;
    } catch (fallbackError) {
      console.error(
        `Tried to parse lud06 as lud16 but error occurred again for ${pubkey}`,
        fallbackError
      );
      return null;
    }
  }
}

async function resolveZapSpecFromMetadataEvent(
  pubkey: string,
  metadataEvent: NDKEvent | null,
  ndkInstance: NDK
): Promise<NDKLnUrlData | null> {
  if (!metadataEvent) return null;
  const profile = profileFromEvent(metadataEvent);
  return resolveZapSpecFromProfile(pubkey, profile, ndkInstance);
}

export async function getZapConfiguration(
  pubkey: string,
  lightningAddress?: string,
  options: ZapConfigOptions = {}
) {
  const $ndk = get(ndk);
  const trimmedAddress = lightningAddress?.trim();
  const fetchPolicy = options.fetchPolicy ?? 'cache-first';
  const relayTimeoutMs = options.relayTimeoutMs ?? 4000;

  if (trimmedAddress) {
    const isLnurl = trimmedAddress.toLowerCase().startsWith('lnurl');

    try {
      const lnurlSpec = await getNip57ZapSpecFromLud(
        {
          lud06: isLnurl ? trimmedAddress : undefined,
          lud16: isLnurl ? undefined : trimmedAddress,
        },
        $ndk
      );

      return lnurlSpec ?? null;
    } catch (err) {
      console.error(`An error occurred in getZapConfiguration for ${pubkey}`, err);
      return null;
    }
  }

  const metadataFilter = {
    kinds: [NDKKind.Metadata],
    authors: [pubkey],
  };

  const metadataRelays = [
    ...$ndk.outboxPool!.connectedRelays(),
    ...$ndk.pool!.connectedRelays(),
  ];

  if (fetchPolicy === 'cache-first') {
    const cachedEvent = await fetchEventFromRelaysFirst($ndk, metadataFilter, {
      relayTimeoutMS: relayTimeoutMs,
      fallbackToCache: false,
      cacheOnly: true,
    });

    const cachedSpec = await resolveZapSpecFromMetadataEvent(pubkey, cachedEvent, $ndk);

    const revalidate = async () => {
      const freshEvent = await fetchEventFromRelaysFirst($ndk, metadataFilter, {
        relayTimeoutMS: relayTimeoutMs,
        fallbackToCache: false,
        explicitRelays: metadataRelays,
      });
      const freshSpec = await resolveZapSpecFromMetadataEvent(pubkey, freshEvent, $ndk);
      options.onRevalidated?.(freshSpec);
      return freshSpec;
    };

    if (cachedSpec) {
      void revalidate();
      return cachedSpec;
    }

    return revalidate();
  }

  const metadataEvent = await fetchEventFromRelaysFirst($ndk, metadataFilter, {
    relayTimeoutMS: relayTimeoutMs,
    fallbackToCache: fetchPolicy === 'relay-first',
    explicitRelays: metadataRelays,
  });

  return resolveZapSpecFromMetadataEvent(pubkey, metadataEvent, $ndk);
}

export async function getCashuPaymentInfo(
  pubkey: string,
  wholeEvent: boolean = false
): Promise<NDKCashuMintList | CashuPaymentInfo | null> {
  const $ndk = get(ndk);

  const filter = {
    kinds: [NDKKind.CashuMintList],
    authors: [pubkey],
  };

  let relays = [
    ...($ndk.outboxPool?.connectedRelays() || []),
    ...($ndk.pool.connectedRelays() || []),
  ];

  if (relays.length === 0) {
    for (const url of DEFAULTRELAYURLS) {
      const relay = new NDKRelay(url, undefined, $ndk);
      relays.push(relay);
    }
  }

  const cashuMintlistEvent = await fetchEventFromRelaysFirst($ndk, filter, {
    relayTimeoutMS: 4000,
    fallbackToCache: false,
    explicitRelays: relays,
  });

  if (!cashuMintlistEvent) {
    console.warn(`Could not fetch Cashu Mint list for ${pubkey}`);
    return null;
  }

  const mintList = NDKCashuMintList.from(cashuMintlistEvent);

  if (wholeEvent) return mintList;

  return {
    mints: mintList.mints,
    relays: mintList.relays,
    p2pk: mintList.p2pk,
  };
}

export function orderEventsChronologically(events: NDKEvent[], reverse: boolean = false) {
  events.sort((e1: NDKEvent, e2: NDKEvent) => {
    if (reverse) return e1.created_at! - e2.created_at!;
    else return e2.created_at! - e1.created_at!;
  });
}

export function arraysAreEqual<T>(arr1: T[], arr2: T[]): boolean {
  // Check if arrays have the same length
  if (arr1.length !== arr2.length) return false;

  // Check if all elements are equal (using deep equality for objects)
  return arr1.every((element, index) => element === arr2[index]);
}

export function shortenTextWithEllipsesInMiddle(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const textCharactersLeftAlone: number = maxLength - 3;
  const lengthOfStart = Math.round(textCharactersLeftAlone / 2);
  const lengthOfEnd: number = textCharactersLeftAlone - lengthOfStart;

  const result =
    text.substring(0, lengthOfStart) + '...' + text.substring(text.length - lengthOfEnd - 1);

  return result;
}

export interface RatingConsensus {
  ratingConsensus: string;
  ratingColor: string;
}

export function averageToRatingText(average: number): RatingConsensus {
  let ratingConsensus = '';
  let ratingColor = '';
  if (isNaN(average)) {
    ratingConsensus = 'No Ratings';
    ratingColor = 'bg-surface-500';
  } else {
    ratingConsensus = 'Excellent';
    ratingColor = 'bg-yellow-500';
    if (average < 0.9) {
      ratingConsensus = 'Great';
      ratingColor = 'bg-tertiary-500';
    }
    if (average < 0.75) {
      ratingConsensus = 'Good';
      ratingColor = 'bg-success-500';
    }
    if (average < 0.5) {
      ratingConsensus = 'Mixed ratings';
      ratingColor = 'bg-surface-500';
    }
    if (average < 0.25) {
      ratingConsensus = 'Bad';
      ratingColor = 'bg-error-500';
    }
  }
  return { ratingConsensus: ratingConsensus, ratingColor: ratingColor };
}

export const getRoboHashPicture = (pubkey: string): string => {
  return `https://robohash.org/${pubkey}`;
};
