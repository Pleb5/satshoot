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
} from '@nostr-dev-kit/ndk';
import ndk, {
  blastrUrl,
  BOOTSTRAPOUTBOXRELAYS,
  DEFAULTRELAYURLS,
  getAppRelays,
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
  wallet,
  walletDecryptFailed as walletDecryptFailedStore,
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
      const userRelays = await fetchUserOutboxRelays(ndk, user.pubkey, 3000);
      let explicitRelays = DEFAULTRELAYURLS;
      if (userRelays) {
        const writeRelayUrls = NDKRelayList.from(userRelays).writeRelayUrls;
        explicitRelays = [...explicitRelays, ...writeRelayUrls];
      }

      fetchAndInitWallet(user, ndk, { explicitRelays }).catch((error) => {
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

export type WalletFetchOpts = {
  fetchLegacyWallet?: boolean;
  explicitRelays?: string[];
};

export type WalletRelayFallback = {
  relayUrls: string[];
  usingAppRelays: boolean;
};

type RelayFetchResult = {
  events: Set<NDKEvent>;
  responsiveRelays: string[];
};

const WALLET_RELAY_FETCH_TIMEOUT_MS = 4000;
const WALLET_DECRYPT_TIMEOUT_MS = 8000;
let walletDecryptToastShownGlobal = false;

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

async function fetchCashuEventsFromRelays(
  ndk: NDKSvelte,
  filter: NDKFilter,
  relayUrls: string[]
): Promise<RelayFetchResult> {
  if (relayUrls.length === 0) {
    return { events: new Set<NDKEvent>(), responsiveRelays: [] };
  }

  const results = await Promise.all(
    relayUrls.map(async (relayUrl) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;

      const timeoutPromise = new Promise<Set<NDKEvent>>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          resolve(new Set());
        }, WALLET_RELAY_FETCH_TIMEOUT_MS);
      });

      try {
        const relaySet = NDKRelaySet.fromRelayUrls([relayUrl], ndk);
        const events = await Promise.race([
          ndk.fetchEvents(
            filter,
            { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY, relaySet }
          ),
          timeoutPromise,
        ]);

        if (timeoutId) clearTimeout(timeoutId);

        if (timedOut) {
          console.warn(
            `Cashu wallet relay ${relayUrl} timed out after ${WALLET_RELAY_FETCH_TIMEOUT_MS}ms.`
          );
        }

        return { relayUrl, events, timedOut };
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.warn(`Cashu wallet relay ${relayUrl} errored while fetching.`, error);
        return { relayUrl, events: new Set<NDKEvent>(), timedOut: true };
      }
    })
  );

  const events = new Set<NDKEvent>();
  const responsiveRelays: string[] = [];

  for (const result of results) {
    if (!result.timedOut) {
      responsiveRelays.push(result.relayUrl);
    }

    for (const event of result.events) {
      events.add(event);
    }
  }

  return { events, responsiveRelays };
}

export async function fetchAndInitWallet(
  user: NDKUser,
  ndk: NDKSvelte,
  walletFetchOpts: WalletFetchOpts = {
    fetchLegacyWallet: true,
  }
): Promise<WalletRelayFallback> {
  walletStatus.set(NDKWalletStatus.LOADING);

  const appRelays = getAppRelays();
  let walletRelays = DEFAULTRELAYURLS;
  let userOutboxRelays: string[] = [];

  if (walletFetchOpts.explicitRelays && walletFetchOpts.explicitRelays.length > 0) {
    walletRelays = walletFetchOpts.explicitRelays;
    userOutboxRelays = walletFetchOpts.explicitRelays;
  } else {
    const userRelays = await fetchUserOutboxRelays(ndk, user.pubkey, 2000);
    if (userRelays) {
      userOutboxRelays = NDKRelayList.from(userRelays).writeRelayUrls;
      walletRelays = [...walletRelays, ...userOutboxRelays];
    }
  }

  const kindsArr = [
    NDKKind.CashuWallet,
    NDKKind.LegacyCashuWallet,
    NDKKind.CashuMintList,
    DeterministicCashuWalletInfoKind,
  ];
  if (walletFetchOpts.fetchLegacyWallet) kindsArr.push(NDKKind.LegacyCashuWallet);

  const filter = {
    kinds: kindsArr,
    authors: [user.pubkey],
  };

  const resolvedWalletRelays = walletRelays.filter(Boolean);
  const resolvedOutboxRelays = userOutboxRelays.filter(Boolean);

  const walletFetch = await fetchCashuEventsFromRelays(ndk, filter, resolvedWalletRelays);
  let cashuEvents = walletFetch.events;

  const walletRelaysAvailable = walletFetch.responsiveRelays.length > 0;
  let effectiveRelays = walletRelaysAvailable ? walletFetch.responsiveRelays : [];

  if (!walletRelaysAvailable) {
    if (resolvedOutboxRelays.length > 0) {
      const outboxFetch = await fetchCashuEventsFromRelays(
        ndk,
        filter,
        resolvedOutboxRelays
      );
      cashuEvents = outboxFetch.events;
      effectiveRelays =
        outboxFetch.responsiveRelays.length > 0
          ? outboxFetch.responsiveRelays
          : resolvedOutboxRelays;
    }

    if (effectiveRelays.length === 0 && appRelays.length > 0) {
      const appFetch = await fetchCashuEventsFromRelays(ndk, filter, appRelays);
      cashuEvents = appFetch.events;
      effectiveRelays =
        appFetch.responsiveRelays.length > 0 ? appFetch.responsiveRelays : appRelays;
    }
  }

  const cashuEventKinds = Array.from(cashuEvents).map((event) => event.kind);
  console.info('cashuEvents loaded', {
    count: cashuEvents.size,
    kinds: cashuEventKinds,
  });
  let nostrWallet: NDKCashuWallet | undefined;
  let cashuMintList: NDKCashuMintList | undefined;
  let deterministicWalletEvent: NDKEvent | undefined;
  let walletDecryptFailed = false;
  let walletDecrypted = false;
  walletDecryptFailedStore.set(false);

  let cashuWalletEvent: NDKEvent | undefined;
  let legacyWalletEvent: NDKEvent | undefined;
  for (const event of cashuEvents) {
    if (event.kind === NDKKind.LegacyCashuWallet) {
      console.info('legacy wallet event')
      legacyWalletEvent = event;
    } else if (event.kind === NDKKind.CashuWallet) {
      console.info('new wallet event')
      cashuWalletEvent = event;
    } else if (event.kind === DeterministicCashuWalletInfoKind) {
      console.info('deterministic wallet event')
      deterministicWalletEvent = event;
      // const ev = event;

      // console.info('start decrypting deterministic wallet event', ev)
      // const content = await ndk.signer?.decrypt(
      //   ndk.getUser({ pubkey: ev.pubkey }),
      //   ev.content,
      //   'nip44'
      // );
      // console.warn('deterministic content:', content);
      console.log('fetchAndInitWallet: found deterministic cashu wallet event', {
        pubkey: event.pubkey,
        contentLength: event.content?.length ?? 0,
      });
    } else if (event.kind === NDKKind.CashuMintList) {
      cashuMintList = NDKCashuMintList.from(event);
    }
  }

  if (deterministicWalletEvent && ndk.signer) {
    const deterministicDecrypt = await withTimeout(
      ndk.signer.decrypt(
        ndk.getUser({ pubkey: deterministicWalletEvent.pubkey }),
        deterministicWalletEvent.content,
        'nip44'
      ),
      WALLET_DECRYPT_TIMEOUT_MS,
      'Deterministic wallet decrypt'
    );

    if (deterministicDecrypt) {
      console.info('Deterministic wallet decrypt success', {
        pubkey: deterministicWalletEvent.pubkey,
        contentLength: deterministicWalletEvent.content?.length ?? 0,
      });
    } else {
      console.warn('Deterministic wallet decrypt failed, skipping deterministic info.', {
        pubkey: deterministicWalletEvent.pubkey,
        contentLength: deterministicWalletEvent.content?.length ?? 0,
      });
      deterministicWalletEvent = undefined;
    }
  }

  const walletCandidates = [cashuWalletEvent, legacyWalletEvent].filter(Boolean) as NDKEvent[];
  const walletRelayUrls = cashuMintList?.relays?.filter(Boolean) ?? [];
  let walletRelaySetUrls = effectiveRelays;
  let walletRelaysUnavailable = false;

  if (walletRelayUrls.length > 0) {
    const walletRelayFetch = await fetchCashuEventsFromRelays(ndk, filter, walletRelayUrls);
    if (walletRelayFetch.responsiveRelays.length > 0) {
      walletRelaySetUrls = walletRelayFetch.responsiveRelays;
    } else {
      walletRelaysUnavailable = true;
      if (resolvedOutboxRelays.length > 0) {
        const outboxFetch = await fetchCashuEventsFromRelays(
          ndk,
          filter,
          resolvedOutboxRelays
        );
        walletRelaySetUrls =
          outboxFetch.responsiveRelays.length > 0
            ? outboxFetch.responsiveRelays
            : resolvedOutboxRelays;
      }

      if (walletRelaySetUrls.length === 0 && appRelays.length > 0) {
        const appFetch = await fetchCashuEventsFromRelays(ndk, filter, appRelays);
        walletRelaySetUrls =
          appFetch.responsiveRelays.length > 0 ? appFetch.responsiveRelays : appRelays;
      }
    }
  }

  for (const candidate of walletCandidates) {
    const encryptionScheme = candidate.content?.includes('?iv=') ? 'nip04' : 'nip44';
    console.info('Cashu wallet decrypt start', {
      kind: candidate.kind,
      pubkey: candidate.pubkey,
      contentLength: candidate.content?.length ?? 0,
      encryptionScheme,
    });
    const walletFromEvent = await withTimeout(
      NDKCashuWallet.from(candidate, deterministicWalletEvent),
      WALLET_DECRYPT_TIMEOUT_MS,
      `Cashu wallet decrypt (kind ${candidate.kind})`
    );
    if (!walletFromEvent) {
      console.warn('could not decrypt wallet implicitly, decrypting directly..');
      let directDecrypt: string | undefined;
      if (ndk.signer) {
        directDecrypt = await withTimeout(
          ndk.signer.decrypt(ndk.getUser({ pubkey: candidate.pubkey }), candidate.content, 'nip44'),
          WALLET_DECRYPT_TIMEOUT_MS,
          `Direct wallet decrypt (kind ${candidate.kind})`
        );
      }
      if (directDecrypt) {
        console.warn('Direct decrypt succeeded but wallet init failed', {
          kind: candidate.kind,
          pubkey: candidate.pubkey,
          contentLength: candidate.content?.length ?? 0,
        });
      }
    }
    if (walletFromEvent) {
      console.info('Cashu wallet decrypt success', {
        kind: candidate.kind,
        pubkey: candidate.pubkey,
        encryptionScheme,
      });
      nostrWallet = walletFromEvent;
      walletDecrypted = true;
      break;
    } else {
      console.warn('Cashu wallet decrypt failed', {
        kind: candidate.kind,
        pubkey: candidate.pubkey,
        encryptionScheme,
      });
      walletDecryptFailed = true;
    }
  }
  if (nostrWallet) {
    const relaySetUrls = walletRelaySetUrls.length > 0 ? walletRelaySetUrls : appRelays;
    nostrWallet.relaySet = NDKRelaySet.fromRelayUrls(relaySetUrls, ndk);
  }
  if (walletDecryptFailed && !walletDecrypted) {
    walletDecryptFailedStore.set(true);
    const signerPubkey = await ndk.signer?.user()?.then((u) => u.pubkey);
    const signerEncryption = await ndk.signer?.encryptionEnabled?.();
    const signerRelayUrls = (ndk.signer as { relayUrls?: string[] } | undefined)?.relayUrls;
    const poolRelayUrls = ndk.pool?.urls?.() ?? [];
    console.warn('Cashu wallet decrypt failure details', {
      signerPubkey: signerPubkey ?? 'unknown',
      signerEncryption,
      signerType: ndk.signer?.constructor?.name ?? 'unknown',
      signerRelayUrls,
      poolRelayUrls,
      walletEventPubkey: cashuWalletEvent?.pubkey,
      legacyWalletEventPubkey: legacyWalletEvent?.pubkey,
      walletEventContentLength: (cashuWalletEvent ?? legacyWalletEvent)?.content?.length ?? 0,
    });

    if (!walletDecryptToastShownGlobal) {
      walletDecryptToastShownGlobal = true;
      toaster.error({
        title: 'Could not decrypt wallet. Check your signer connection.',
      });
    }
  }

  const relayFallback = {
    relayUrls: walletRelaySetUrls.length > 0 ? walletRelaySetUrls : appRelays,
    usingAppRelays: walletRelaysUnavailable,
  };

  if (relayFallback.usingAppRelays) {
    toaster.warning({
      title: 'Wallet relays are unavailable. Using app relays temporarily.',
    });
  }

  if (nostrWallet && cashuMintList) {
    const walletInitPromise = walletInit(nostrWallet, cashuMintList, ndk, user);
    await Promise.race([
      walletInitPromise,
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.warn('Wallet init timed out, continuing with limited data.');
          walletStatus.set(NDKWalletStatus.READY);
          resolve();
        }, WALLET_RELAY_FETCH_TIMEOUT_MS)
      ),
    ]);
  } else if (walletDecryptFailed && !walletDecrypted) {
    walletStatus.set(NDKWalletStatus.READY);
  } else {
    walletStatus.set(NDKWalletStatus.FAILED);
  }

  const subscriptionRelays = nostrWallet?.relaySet?.relayUrls ?? [];
  if (walletRelaysUnavailable || subscriptionRelays.length === 0) {
    setTimeout(() => {
      if (get(walletStatus) !== NDKWalletStatus.READY) {
        walletStatus.set(NDKWalletStatus.READY);
      }
    }, WALLET_RELAY_FETCH_TIMEOUT_MS);
  }

  return relayFallback;
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

  if (!broadCastOpts.replaceable) {
    console.info('Broadcast event signing', {
      kind: ndkEvent.kind,
      pubkey: ndkEvent.pubkey,
      signerPubkey: await ndk.signer?.user()?.then((u) => u.pubkey),
    });
    const relays = await ndkEvent.publish(NDKRelaySet.fromRelayUrls(relayUrls, ndk));
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
    const relays = await ndkEvent.publishReplaceable(NDKRelaySet.fromRelayUrls(relayUrls, ndk));
    console.info('Broadcast replaceable event published', {
      kind: ndkEvent.kind,
      relays: Array.from(relays).map((relay) => relay.url),
    });
    return relays;
  }
}

export async function checkRelayConnections() {
  const $ndk = get(ndk);

  const anyConnectedRelays = $ndk.pool.stats().connected !== 0;
  console.log('Checking relay connections');
  console.log(`Connected relays: ${$ndk.pool.stats().connected}`);

  if (!anyConnectedRelays) {
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
      setTimeout(checkRelayConnections, retryDelay);
    }
  } else {
    // We are sufficiently connected
    connected.set(true);
    retriesLeft.set(maxRetryAttempts);
  }
}

export async function getZapConfiguration(pubkey: string, lightningAddress?: string) {
  const $ndk = get(ndk);
  const trimmedAddress = lightningAddress?.trim();

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

  const metadataRelays = [...$ndk.outboxPool!.connectedRelays(), ...$ndk.pool!.connectedRelays()];

  const metadataEvent = await fetchEventFromRelaysFirst($ndk, metadataFilter, {
    relayTimeoutMS: 4000,
    fallbackToCache: true,
    explicitRelays: metadataRelays,
  });

  if (!metadataEvent) return null;

  const profile = profileFromEvent(metadataEvent);

  if (!profile.lud16) return null;

  try {
    const lnurlSpec = await getNip57ZapSpecFromLud(
      {
        lud06: profile.lud06,
        lud16: profile.lud16,
      },
      $ndk
    );

    if (!lnurlSpec) {
      return null;
    }

    return lnurlSpec;
  } catch (err) {
    console.error(`An error occurred in getZapConfiguration for ${pubkey}`, err);
    console.error('Try to parse lud06 as lud16 as last resort..');
    try {
      // try if lud06 is actually a lud16
      const lnurlSpec = await getNip57ZapSpecFromLud(
        { lud06: undefined, lud16: profile.lud06 },
        $ndk
      );

      if (!lnurlSpec) {
        return null;
      }

      return lnurlSpec;
    } catch (err) {
      console.error(
        `Tried to parse lud06 as lud16 but error occurred again for ${pubkey}`,
        err
      );
      return null;
    }
  }
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
