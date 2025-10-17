import {
    NDKEvent,
    type NDKSigner,
    NDKKind,
    NDKRelayList,
    NDKRelay,
    NDKSubscriptionCacheUsage,
    profileFromEvent,
    getNip57ZapSpecFromLud,
    NDKRelaySet,
    NDKCashuMintList,
    type CashuPaymentInfo,
    serializeProfile,
    NDKUser,
} from '@nostr-dev-kit/ndk';
import ndk, {
    blastrUrl,
    BOOTSTRAPOUTBOXRELAYS,
    DEFAULTRELAYURLS,
    sessionPK,
} from '$lib/stores/session';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import currentUser, { onBoarding } from '../stores/user';
import { loggedIn, loggingIn, loginMethod, followsUpdated } from '../stores/user';
import { loadWot, networkWoTScores } from '../stores/wot';
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
import { ndkNutzapMonitor, wallet, walletInit, walletStatus } from '$lib/wallet/wallet';
import { NDKCashuWallet, NDKWalletStatus } from '@nostr-dev-kit/ndk-wallet';
import { fetchEventFromRelaysFirst, APP_RELAY_STORAGE_KEY } from '$lib/utils/misc';

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

        const $onboarding = get(onBoarding);
        if (!$onboarding) {
            const userRelays = await fetchUserOutboxRelays(ndk, user.pubkey, 3000);
            let explicitRelays = DEFAULTRELAYURLS;
            if (userRelays) {
                const writeRelayUrls = NDKRelayList.from(userRelays).writeRelayUrls;
                explicitRelays = [...explicitRelays, ...writeRelayUrls];
            }

            fetchAndInitWallet(user, ndk, { explicitRelays });

            await loadWot(ndk, user);
        }

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

export async function fetchAndInitWallet(
    user: NDKUser,
    ndk: NDKSvelte,
    walletFetchOpts: WalletFetchOpts = {
        fetchLegacyWallet: true,
    }
) {
    walletStatus.set(NDKWalletStatus.LOADING);

    let relays = DEFAULTRELAYURLS;
    if (!walletFetchOpts.explicitRelays || walletFetchOpts.explicitRelays.length === 0) {
        const userRelays = await fetchUserOutboxRelays(ndk, user.pubkey, 2000);
        if (userRelays) {
            relays = [...relays, ...NDKRelayList.from(userRelays).writeRelayUrls];
        }
    }

    const kindsArr = [NDKKind.CashuWallet, NDKKind.LegacyCashuWallet, NDKKind.CashuMintList];
    if (walletFetchOpts.fetchLegacyWallet) kindsArr.push(NDKKind.LegacyCashuWallet);

    const cashuPromise = ndk.fetchEvents(
        {
            kinds: kindsArr,
            authors: [user.pubkey],
        },
        { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY },
        NDKRelaySet.fromRelayUrls(relays, ndk)
    );

    const cashuEvents: Set<NDKEvent> = await cashuPromise;

    console.info('cashuEvents loaded:', cashuEvents);
    let nostrWallet: NDKCashuWallet | undefined;
    let cashuMintList: NDKCashuMintList | undefined;
    let checkLegacy = true;
    for (const event of cashuEvents) {
        if (event.kind === NDKKind.LegacyCashuWallet && checkLegacy) {
            nostrWallet = await NDKCashuWallet.from(event);
        } else if (event.kind === NDKKind.CashuWallet) {
            checkLegacy = false;
            nostrWallet = await NDKCashuWallet.from(event);
        } else if (event.kind === NDKKind.CashuMintList) {
            cashuMintList = NDKCashuMintList.from(event);
        }
    }
    if (nostrWallet && cashuMintList) {
        walletInit(nostrWallet, cashuMintList, ndk, user);
    } else {
        walletStatus.set(NDKWalletStatus.FAILED);
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
    localStorage.removeItem('walletBackup');
    localStorage.removeItem('followsUpdated');
    localStorage.removeItem('tabStore');
    localStorage.removeItem('jobTabStore');
    localStorage.removeItem('bidTabStore');
    localStorage.removeItem('notificationsEnabled');
    localStorage.removeItem('serviceWorkerRegFailed');
    localStorage.removeItem('useSatShootWoT');
    localStorage.removeItem('networkWoTScores');
    localStorage.removeItem('seenIDs');
    localStorage.removeItem('nostr-seedwords');
    localStorage.removeItem('nostr-npub');
    localStorage.removeItem('nostr-nsec');
    localStorage.removeItem('pk');
    localStorage.removeItem('nip46SignerPayload');
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

    const queryRelays: Array<NDKRelay> = [];

    queryRelaysUrls.forEach((url) => {
        queryRelays.push(new NDKRelay(url, undefined, ndk));
    });

    const relayFilter = {
        kinds: [NDKKind.RelayList],
        authors: [pubkey],
    };

    let relays = await fetchEventFromRelaysFirst(relayFilter, {
        relayTimeoutMS: timeout,
        fallbackToCache: true,
        explicitRelays: queryRelays,
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
        return await ndkEvent.publish(NDKRelaySet.fromRelayUrls(relayUrls, ndk));
    } else {
        return await ndkEvent.publishReplaceable(NDKRelaySet.fromRelayUrls(relayUrls, ndk));
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

export type RelayFirstFetchOpts = {
    relayTimeoutMS: number;
    fallbackToCache: boolean;
    explicitRelays?: NDKRelay[];
};

export async function getZapConfiguration(pubkey: string) {
    const $ndk = get(ndk);

    const metadataFilter = {
        kinds: [NDKKind.Metadata],
        authors: [pubkey],
    };

    const metadataRelays = [...$ndk.outboxPool!.connectedRelays(), ...$ndk.pool!.connectedRelays()];

    const metadataEvent = await fetchEventFromRelaysFirst(metadataFilter, {
        relayTimeoutMS: 5000,
        fallbackToCache: false,
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

    const cashuMintlistEvent = await fetchEventFromRelaysFirst(filter, {
        relayTimeoutMS: 5000,
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
