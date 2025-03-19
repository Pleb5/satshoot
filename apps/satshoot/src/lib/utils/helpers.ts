import {
    NDKEvent,
    type NDKSigner,
    NDKKind,
    NDKRelayList,
    NDKRelay,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
    profileFromEvent,
    getNip57ZapSpecFromLud,
    NDKRelaySet,
    NDKCashuMintList,
    type CashuPaymentInfo,
    type NDKUserProfile,
    serializeProfile,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';

import ndk, { blastrUrl, BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/ndk';

import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';

import currentUser, { fetchFreelanceFollowEvent } from '../stores/user';
import { loggedIn, loggingIn, loginMethod, followsUpdated } from '../stores/user';

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
import { notifications, seenIDs } from '../stores/notifications';

import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { dev } from '$app/environment';
import { connected, sessionPK } from '../stores/ndk';
import { retryConnection, retryDelay, maxRetryAttempts } from '../stores/network';
import { ndkNutzapMonitor, wallet, walletInit } from '$lib/stores/wallet';
import { nip19 } from 'nostr-tools';
import { OnboardingStep, onboardingStep } from '$lib/stores/gui';
import { type ToastStore } from '@skeletonlabs/skeleton';

export async function initializeUser(ndk: NDKSvelte, toastStore: ToastStore) {
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

        // initialize user wallet for ecash payments
        walletInit(ndk, user);

        const $onboardingStep = get(onboardingStep);

        // no need to fetch relays, update follows and wot when user just created the account
        if ($onboardingStep !== OnboardingStep.Account_Created) {
            // fetch users relays. If there are no outbox relays,
            // prompt the user in a Toast to setup his relays
            const relays = await fetchUserOutboxRelays(ndk);
            if (!relays) {
                toastStore.trigger({
                    message: 'Could not find Your personal Relays',
                    background: 'bg-warning-300-600-token',
                    autohide: false,
                    action: {
                        label: 'Configure',
                        response: () => {
                            goto('/settings/relays');
                        },
                    },
                });
            }

            const $followsUpdated = get(followsUpdated) as number;
            // Update wot every 5 hours: Newbies can get followers and after 5 hours
            // their actions will be visible to a decent amount of people
            const updateDelay = Math.floor(Date.now() / 1000) - 60 * 60 * 5;

            const $networkWoTScores = get(networkWoTScores);

            if (
                $followsUpdated < updateDelay ||
                !$networkWoTScores ||
                $networkWoTScores.size === 0
            ) {
                // console.log('wot outdated, updating...')
                await updateFollowsAndWotScore(ndk);
                // console.log('wot updated')
                // wotArray = Array.from(get(wot));
            }

            // fetch the freelance follow event of current user
            await fetchFreelanceFollowEvent(user.pubkey);
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
    } catch (e) {
        console.log('Could not initialize User. Reason: ', e);
    }
}

export function logout() {
    console.log('logout');

    loggedIn.set(false);

    loginMethod.set(null);

    followsUpdated.set(0);
    networkWoTScores.set(null);

    currentUser.set(null);

    // We dont remove modeCurrent(dark/light theme), debug and app_updated_at entries
    localStorage.removeItem('unsavedProofsBackup');
    localStorage.removeItem('cashuTokensBackup');
    localStorage.removeItem('followsUpdated');
    localStorage.removeItem('tabStore');
    localStorage.removeItem('ticketTabStore');
    localStorage.removeItem('offerTabStore');
    localStorage.removeItem('notificationsEnabled');
    localStorage.removeItem('useSatShootWoT');
    localStorage.removeItem('networkWoTScores');
    localStorage.removeItem('seenIDs');
    localStorage.removeItem('nostr-seedwords');
    localStorage.removeItem('login-method');
    localStorage.removeItem('nostr-npub');
    localStorage.removeItem('nostr-nsec');
    localStorage.removeItem('pk');
    localStorage.removeItem('bunkerLocalSignerPK');
    localStorage.removeItem('bunkerTargetNpub');
    localStorage.removeItem('bunkerRelayURLs');
    localStorage.removeItem('readNotifications');
    localStorage.removeItem('jobFilter');
    localStorage.removeItem('offerFilter');

    sessionStorage.clear();

    sessionPK.set('');

    seenIDs.set(new Set());
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

    wallet.set(null);

    if (ndkNutzapMonitor) {
        ndkNutzapMonitor.stop();
    }

    get(ndk).signer = undefined;

    goto('/');
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

export async function fetchUserOutboxRelays(
    ndk: NDKSvelte,
    pubkey?: string
): Promise<NDKEvent | null> {
    const queryRelaysUrls = [...ndk.pool.urls(), ...ndk.outboxPool!.urls()];

    const queryRelays: Array<NDKRelay> = [];

    queryRelaysUrls.forEach((url) => {
        queryRelays.push(new NDKRelay(url, undefined, ndk));
    });

    if (!pubkey) {
        const $currentUser = get(currentUser);
        pubkey = $currentUser!.pubkey;
    }

    const relayFilter = {
        kinds: [NDKKind.RelayList],
        authors: [pubkey],
    };

    let relays = await fetchEventFromRelaysFirst(relayFilter, 4000, true, queryRelays);

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

    const relaysPosted = await broadcastEvent(ndk, userRelayList, {explicitRelays: [...writeRelayUrls]});
    console.log('relays posted to:', relaysPosted);
}

export async function broadcastUserProfile(ndk: NDKSvelte, userProfile: NDKUserProfile) {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.content = serializeProfile(userProfile);
    ndkEvent.kind = NDKKind.Metadata;

    const explicitRelays: string[] = [];

    const relayListEvent = await fetchUserOutboxRelays(ndk);
    if (relayListEvent) {
        const relayList = NDKRelayList.from(relayListEvent);
        explicitRelays.push(...relayList.writeRelayUrls);
    }

    const relaysPosted = await broadcastEvent(ndk, ndkEvent, {explicitRelays});
    console.log('userProfile posted to:', relaysPosted);
}

export type BroadCastOpts = {
    explicitRelays?: string[],
    includePoolRelays?: boolean,
    includeOutboxPoolRelays?: boolean,
    includeBlastUrl?: boolean,
    replaceable?: boolean,
}
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
    const relayUrls = [...broadCastOpts.explicitRelays ?? []];

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
        return await ndkEvent.publishReplaceable(
            NDKRelaySet.fromRelayUrls(relayUrls, ndk)
        );
    }
}

export async function checkRelayConnections() {
    const $ndk = get(ndk);

    const anyConnectedRelays = $ndk.pool.stats().connected !== 0;

    if (!anyConnectedRelays) {
        connected.set(false);
        let retriesLeft = get(retryConnection);
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
        // We are sufficiently connected
        connected.set(true);
        retryConnection.set(maxRetryAttempts);
    }
}

export async function fetchEventFromRelaysFirst(
    filter: NDKFilter,
    relayTimeoutMS: number = 6000,
    fallbackToCache: boolean = false,
    relays?: NDKRelay[]
): Promise<NDKEvent | null> {
    const $ndk = get(ndk);

    // If relays are provided construct a set and pass over to sub
    const relaySet = relays ? new NDKRelaySet(new Set(relays), $ndk) : undefined;

    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            resolve(null);
        }, relayTimeoutMS);
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
    } else if (!fetchedEvent && !fallbackToCache) {
        return null;
    }

    const cachedEvent = await $ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE,
        groupable: false,
    });

    return cachedEvent;
}

export async function getZapConfiguration(pubkey: string) {
    const $ndk = get(ndk);

    const metadataFilter = {
        kinds: [NDKKind.Metadata],
        authors: [pubkey],
    };

    const metadataRelays = [...$ndk.outboxPool!.connectedRelays(), ...$ndk.pool!.connectedRelays()];

    const metadataEvent = await fetchEventFromRelaysFirst(
        metadataFilter,
        5000,
        false,
        metadataRelays
    );

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

    const relays = [...$ndk.outboxPool!.connectedRelays(), ...$ndk.pool!.connectedRelays()];

    const cashuMintlistEvent = await fetchEventFromRelaysFirst(filter, 5000, false, relays);

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

    events = events;
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
        ratingColor = 'bg-warning-500';
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
