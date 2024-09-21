import {
    type NDKSigner,
    type NDKEvent,
    NDKKind,
    NDKRelayList,
    NDKRelay,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
    profileFromEvent,
    getNip57ZapSpecFromLud,
} from '@nostr-dev-kit/ndk';

import ndk, { blastrUrl, BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/ndk';

import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';

import currentUser from '../stores/user';
import {
    loggedIn,
    loggingIn,
    loginMethod,
    retryUserInit,
    followsUpdated,
    userRelaysUpdated,
} from '../stores/user';

import { updateFollowsAndWotScore, networkWoTScores } from '../stores/wot';

import { allReviews } from '$lib/stores/reviews';

import { allReceivedZapsFilter, allReceivedZaps } from '$lib/stores/zaps';

import { messageStore, sentMessageFilter, receivedMessageFilter } from '$lib/stores/messages';

import {
    allTickets,
    allOffers,
    myTicketFilter,
    myOfferFilter,
    myTickets,
    myOffers,
} from '$lib/stores/freelance-eventstores';

import { DEFAULTRELAYURLS } from '$lib/stores/ndk';
import { notifications } from '../stores/notifications';

import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { dev, browser } from '$app/environment';
import { connected, sessionPK } from '../stores/ndk';
import { retryConnection, retryDelay, maxRetryAttempts } from '../stores/network';

export async function initializeUser(ndk: NDKSvelte) {
    console.log('begin user init');
    try {
        loggingIn.set(false);

        const user = await (ndk.signer as NDKSigner).user();
        if (user.npub) {
            loggedIn.set(true);
        } else return;

        currentUser.set(user);

        myTicketFilter.authors! = [user.pubkey];
        myOfferFilter.authors! = [user.pubkey];

        myTickets.startSubscription();
        myOffers.startSubscription();

        // --------- User Profile --------------- //
        const profile = await user.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.PARALLEL });
        // for now loading profile from cache disabled but if reenabled, this bug
        // that profile returned is a strangely nested object should be handled
        if (profile) {
            user.profile = profile;
        }
        currentUser.set(user);

        // fetch users relays. If there are no outbox relays, set default ones
        const relays = await fetchUserOutboxRelays(ndk);
        if (!relays) {
            broadcastRelayList(ndk, DEFAULTRELAYURLS, DEFAULTRELAYURLS);
            userRelaysUpdated.set(true);
        }

        const $followsUpdated = get(followsUpdated) as number;
        // Update wot every 5 hours: Newbies can get followers and after 5 hours
        // their actions will be visible to a decent amount of people
        const updateDelay = Math.floor(Date.now() / 1000) - 60 * 60 * 5;

        // let wotArray: string[] = Array.from(get(wot));
        const $networkWoTScores = get(networkWoTScores);

        if ($followsUpdated < updateDelay || !$networkWoTScores || $networkWoTScores.size === 0) {
            // console.log('wot outdated, updating...')
            await updateFollowsAndWotScore(ndk);
            // console.log('wot updated')
            // wotArray = Array.from(get(wot));
        }

        // Start all tickets/offers sub
        allTickets.startSubscription();
        allOffers.startSubscription();

        receivedMessageFilter['#p']! = [user.pubkey];
        sentMessageFilter['authors'] = [user.pubkey];
        allReceivedZapsFilter['#p']! = [user.pubkey];

        // Start message and review subs after successful wot and follow recalc
        messageStore.startSubscription();
        allReviews.startSubscription();
        allReceivedZaps.startSubscription();

        retryUserInit.set(false);
    } catch (e) {
        console.log('Could not initialize User. Reason: ', e);
        if (browser && !get(retryUserInit)) {
            retryUserInit.set(true);
            console.log('Retrying...');
            window.location.reload();
        }
    }
}

export function logout() {
    console.log('logout');

    loggedIn.set(false);

    loginMethod.set(null);

    followsUpdated.set(0);
    networkWoTScores.set(null);

    currentUser.set(null);

    localStorage.clear();
    sessionStorage.clear();

    sessionPK.set('');

    myTickets.empty();
    myOffers.empty();
    myTicketFilter.authors = [];
    myOfferFilter.authors = [];

    allTickets.empty();
    allOffers.empty();

    messageStore.empty();
    allReviews.empty();
    allReceivedZaps.empty();

    notifications.set([]);

    get(ndk).signer = undefined;

    goto('/ticket-feed');
}

export async function getActiveServiceWorker(): Promise<ServiceWorker | null> {
    if ('serviceWorker' in navigator) {
        let registeredSW = await (
            navigator.serviceWorker as ServiceWorkerContainer
        ).getRegistration();
        if (!registeredSW) {
            console.log('No registered Service Worker for this page!');
            console.log('Trying to register one...');
            // Try to register new service worker here
            registeredSW = await (navigator.serviceWorker as ServiceWorkerContainer).register(
                '/service-worker.js',
                { type: dev ? 'module' : 'classic' }
            );

            if (!registeredSW) return null;
        }

        const activeSW = registeredSW.active;
        if (activeSW) {
            return activeSW;
        } else {
            console.log('No active Service Worker. Must wait for it...');
            console.log((navigator.serviceWorker as ServiceWorkerContainer).getRegistrations());

            let pendingSW;
            if (registeredSW.installing) {
                pendingSW = registeredSW.installing;
            } else if (registeredSW.waiting) {
                pendingSW = registeredSW.waiting;
            }

            if (pendingSW) {
                pendingSW.onstatechange = (event: Event) => {
                    if (registeredSW!.active) {
                        console.log('Regsitered Service worker activated!');
                    }
                };
            }
        }
    } else {
        console.log('service worker not supported');
        return null;
    }

    return null;
}

export async function fetchUserOutboxRelays(ndk: NDKSvelte): Promise<NDKEvent | null> {
    const $currentUser = get(currentUser);

    // const queryRelays = NDKRelaySet.fromRelayUrls([
    //     ...ndk.pool.urls(),
    //     ...ndk.outboxPool!.urls()
    // ], ndk);

    const relays = await ndk.fetchEvent(
        { kinds: [NDKKind.RelayList], authors: [$currentUser!.pubkey] },
        {
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            groupable: false,
        }
        // queryRelays,
    );
    console.log('outbox relays', relays);
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

    ndk.pool.useTemporaryRelay(new NDKRelay(blastrUrl, undefined, ndk));
    // const broadCastRelaySet = NDKRelaySet.fromRelayUrls([
    //     blastrUrl,
    //     ...ndk.pool.urls(),
    //     ...ndk.outboxPool!.urls()
    // ], ndk);
    console.log('relays sending to:', ndk.pool.urls());

    const relaysPosted = await userRelayList.publish();
    console.log('relays posted to:', relaysPosted);
}

export function freelancerZap(zap: NDKEvent): boolean {
    const zapKind = zap.kind === NDKKind.Zap;
    if (!zapKind) {
        return false;
    }

    const aTag = zap.tagValue('a');

    if (!aTag) return false;

    const kindFromATag = aTag.split(':')[0];

    if (!kindFromATag) return false;

    if (kindFromATag) {
        const offerEventZapped = parseInt(kindFromATag) === NDKKind.FreelanceOffer;

        if (!offerEventZapped) return false;
    }

    return true;
}

export async function checkRelayConnections() {
    const $ndk = get(ndk);
    const $currentUser = get(currentUser);
    console.log('Check relays and try to reconnect if they are down..');
    console.log('relays connected = ', $ndk.pool.stats().connected);

    const anyConnectedRelays = $ndk.pool.stats().connected !== 0;
    let readAndWriteRelaysExist = false;

    // Only bother to check stronger condition if weaker is met
    if (anyConnectedRelays && $currentUser) {
        console.log('There are connected relays, check user read and write relays..');
        const relays = await $ndk.fetchEvent(
            { kinds: [NDKKind.RelayList], authors: [$currentUser!.pubkey] },
            {
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                groupable: false,
            }
        );

        if (relays) {
            const relayList = NDKRelayList.from(relays);
            let readRelayExists = false;
            let writeRelayExists = false;

            // Check if user has at least 1 read and 1 write relay connected
            for (const connectedPoolRelay of $ndk.pool.connectedRelays()) {
                relayList.readRelayUrls.forEach((url: string) => {
                    if (connectedPoolRelay.url === url) {
                        console.log('There is a connected user read relay');
                        readRelayExists = true;
                    }
                });

                relayList.writeRelayUrls.forEach((url: string) => {
                    if (connectedPoolRelay.url === url) {
                        console.log('There is a connected user write relay');
                        writeRelayExists = true;
                    }
                });

                if (readRelayExists && writeRelayExists) {
                    readAndWriteRelaysExist = true;
                    break;
                }
            }
        }
    }

    if (!anyConnectedRelays || ($currentUser && !readAndWriteRelaysExist)) {
        connected.set(false);
        let retriesLeft = get(retryConnection);
        console.log('Any relays conected: ', anyConnectedRelays);
        console.log('Any read and write relays conected: ', readAndWriteRelaysExist);
        console.log('retryConnection', retriesLeft);
        if (retriesLeft > 0) {
            retriesLeft -= 1;
            retryConnection.set(retriesLeft);
            // Try to reconnect to relays, timeout in 2sec for each relay
            $ndk.pool.connect(2000);
            // Re-check recursively when retry delay expires
            // This sets an explicit cap on retries.
            // After retryDelay X retryConnection amount of time is elapsed
            // retry process is concluded and either we reconnected or
            // user needs to fix network and reload page (toast with btn is shown)
            setTimeout(checkRelayConnections, retryDelay);
        }
    } else {
        console.log('We are sufficiently connected, reset max retries');
        connected.set(true);
        retryConnection.set(maxRetryAttempts);
    }
}

export async function fetchEventFromRelays(
    filter: NDKFilter,
    timeoutMS: number = 15000,
    fallbackToCache: boolean = false
) {
    const $ndk = get(ndk);

    const promise = new Promise<NDKEvent>((resolve, reject) => {
        let fetchedEvent: NDKEvent | null = null;

        const relayOnlySubscription = $ndk.subscribe(filter, {
            cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
            closeOnEose: true,
            groupable: false,
        });

        const timeout = setTimeout(() => {
            relayOnlySubscription.stop();

            if (fetchedEvent) {
                return resolve(fetchedEvent);
            }

            reject('Could not fetch event from relay within specified period of time');
        }, timeoutMS);

        relayOnlySubscription.on('event', (event: NDKEvent) => {
            event.ndk = $ndk;

            // We only emit immediately when the event is not replaceable
            if (!event.isReplaceable()) {
                clearTimeout(timeout);
                relayOnlySubscription.stop();
                resolve(event);
            } else if (!fetchedEvent || fetchedEvent.created_at! < event.created_at!) {
                fetchedEvent = event;
            }
        });

        relayOnlySubscription.start();
    });

    if (fallbackToCache) {
        const cachedPromise = $ndk.fetchEvent(filter, {
            cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE,
            closeOnEose: true,
            groupable: false,
        });

        const eventFromRelay = await promise.catch((err) => {
            console.error(err);
            return null;
        });
        if (eventFromRelay) return eventFromRelay;

        const cachedEvent = await cachedPromise.catch((err) => {
            console.error(err);
            return null;
        });
        if (cachedEvent) return cachedEvent;

        throw new Error('Could not fetch event from both relay and cache');
    }

    return promise;
}

export async function getZapConfiguration(pubkey: string) {
    const metadataEvent = await fetchEventFromRelays(
        {
            kinds: [NDKKind.Metadata],
            authors: [pubkey],
        },
        5000
    ).catch((err) => {
        console.error(`An error occurred in getZapConfiguration for ${pubkey}`, err);
        return null;
    });

    if (!metadataEvent) return null;

    const profile = profileFromEvent(metadataEvent);

    const { lud06, lud16 } = profile;

    const $ndk = get(ndk);
    const lnurlSpec = await getNip57ZapSpecFromLud({ lud06, lud16 }, $ndk)
        .then((res) => {
            if (!res) return null;

            return res;
        })
        .catch((err) => {
            console.error(`An error occurred in getZapConfiguration for ${pubkey}`, err);
            return null;
        });

    return lnurlSpec;
}
