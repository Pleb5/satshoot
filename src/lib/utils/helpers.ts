import type { 
    NDKSigner, 
    NDKEvent,
    NDKSubscription,
    NDKUser,
    Hexpubkey,
    NDKFilter,
    NDKTag,
} from '@nostr-dev-kit/ndk';

import {
    NDKSubscriptionCacheUsage,
    NDKRelaySet,
    NDKKind,
    NDKRelayList ,
    NDKRelay,
} from '@nostr-dev-kit/ndk';

import type { NDKSvelte, NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';

import { TicketEvent } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import {
    loggedIn,
    currentUserFollows,
    networkWoTScores,
    minWot,
    unkownWot,
    firstOrderFollowWot,
    secondOrderFollowWot,
    firstOrderMuteWot,
    secondOrderMuteWot,
    firstOrderReportWot,
    secondOrderReportWot,
    wotUpdated,
    followsUpdated,
} from '../stores/user';

import { percentile } from '$lib/utils/misc';

import currentUser from '../stores/user';
import { BTCTroubleshootPubkey } from '../stores/user';

import notificationsEnabled from '$lib/stores/notifications';

import { get } from "svelte/store";
import { dev } from '$app/environment';

import { 
    myTicketFilter, myOfferFilter, myTickets, myOffers,
    ticketsOfMyOffers, offersOfMyTickets,
} from "$lib/stores/troubleshoot-eventstores";

import { BTCTroubleshootKind } from '$lib/events/kinds';

import {nip19} from 'nostr-tools';

export async function initializeUser(ndk: NDK) {
    try {
        const user = await (ndk.signer as NDKSigner).user();
        if (user.npub) {
            loggedIn.set(true);
        } else return;

        currentUser.set(user);
        ndk.outboxTracker.track(user);

        // --------------- User Subscriptions -------------- //
        ticketsOfMyOffers.startSubscription();
        offersOfMyTickets.startSubscription();


        //
        // --------- Notifications based on myOffers and myTickets -------- //

        requestNotifications( 
            (ticketsOfMyOffers as NDKEventStore<ExtendedBaseType<TicketEvent>>).subscription!
        );

        requestNotifications( 
            (offersOfMyTickets as NDKEventStore<ExtendedBaseType<OfferEvent>>).subscription!
        );

        myTicketFilter.authors?.push(user.pubkey);
        myOfferFilter.authors?.push(user.pubkey);

        myTickets.startSubscription();
        myOffers.startSubscription();

        // --------- User Profile --------------- //

        await user.fetchProfile();
        currentUser.set(user);

        // Update wot score
        const $networkWoTScores = get(networkWoTScores) as Map<Hexpubkey, number>;
        console.log('networkWoTScores: ', $networkWoTScores)
        const networkSize:number = $networkWoTScores?.size ?? 0; 

        const $followsUpdated = get(followsUpdated) as number;
        const twoWeeksAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 14;

        console.log(networkSize)
        updateFollowsAndWotScore(ndk);
        if ($followsUpdated < twoWeeksAgo) {
            // console.log(networkSize)
            // updateFollowsAndWotScore();
        }
    } catch(e) {
        console.log('Could not initialize User. Reason: ', e)
    }
}

export function restartEventStoreWithNotification<NDKEventStore>(store: NDKEventStore) {
    store.unsubscribe();
    store.startSubscription();
    requestNotifications(store.subscription);
}

function requestNotifications(subscription: NDKSubscription) {
    // console.log('requesting notifications...', subscription)
    subscription.on("event", 
        async (event: NDKEvent, r: NDKRelay, subscription: NDKSubscription) => {
            // Check for new unique events not served from cache
            // console.log('checking notificationsEnabled')
            if(get(notificationsEnabled) 
                && subscription.eventFirstSeen.get(event.id) !== 0
            ) {
                const activeSW = await getActiveServiceWorker()
                if(!activeSW) {
                    console.log('Notifications are only served through Service Workers\
                        and there is no Service Worker available!')
                    return;
                }

                console.log('new unique event arrived in SW', event)
                // event was NOT received from cache and is not a duplicate
                // so we Notify the user about a new _unique_ event reveived
                let title = '';
                let body = '';
                let tag = '';

                // The Ticket of our _Offer_ was updated
                if (event.kind === BTCTroubleshootKind.Ticket) {
                    title = 'Offer update arrived!';
                    body = 'Check your Offers!';
                    tag = BTCTroubleshootKind.Ticket.toString();
                // The Offer on our _Ticket_ was updated
                } else if(event.kind === BTCTroubleshootKind.Offer) {
                    title = 'Ticket update arrived!';
                    body = 'Check your Tickets!';
                    tag = BTCTroubleshootKind.Offer.toString();
                }

                activeSW.postMessage({
                    notification: 'true',
                    title: title,
                    body: body,
                    tag: tag,
                });
            }
        }
    );
}

export async function getActiveServiceWorker(): Promise<ServiceWorker | null> {
    if ('serviceWorker' in navigator) {
        let registeredSW = await 
                (navigator.serviceWorker as ServiceWorkerContainer).getRegistration();
        if (!registeredSW) {
            console.log('No registered Service Worker for this page!');
            console.log('Trying to register one...');
            // Try to register new service worker here
            registeredSW = await 
                (navigator.serviceWorker as ServiceWorkerContainer).register(
                '/service-worker.js',
                {	type: dev ? 'module' : 'classic'}
            );

            if(!registeredSW) return null;
        }

        const activeSW = registeredSW.active;
        if(activeSW) {
            return activeSW;
        } else {
            console.log('No active Service Worker. Must wait for it...')
            console.log(
                (navigator.serviceWorker as ServiceWorkerContainer).getRegistrations()
            );

            let pendingSW;
            if(registeredSW.installing) {
                pendingSW = registeredSW.installing;
            } else if(registeredSW.waiting) {
                pendingSW = registeredSW.waiting;
            }

            if(pendingSW) {
                pendingSW.onstatechange = (event: Event) => {
                    if(registeredSW!.active) {
                        console.log('Regsitered Service worker activated!')
                    }
                };
            }
        }
    } else {
        console.log('service worker not supported')
        return null;
    }

    return null;
}

export async function updateFollowsAndWotScore(ndk: NDKSvelte) {
    const user = get(currentUser);
    try {
        if (!user) throw new Error('Could not get user');
        const $networkWoTScores = new Map<Hexpubkey, number>();
        const $currentUserFollows = new Set<Hexpubkey>();
        currentUserFollows.set($currentUserFollows);
        networkWoTScores.set($networkWoTScores);

        const queryRelayMap = await NDKRelayList.forUsers([user.pubkey, BTCTroubleshootPubkey], ndk);
        console.log('relay map', queryRelayMap)

        const userWriteRelays = queryRelayMap.get(user.pubkey)?.writeRelayUrls;
        const bootstrapWriteRelays = queryRelayMap.get(BTCTroubleshootPubkey)?.writeRelayUrls;

        if (!userWriteRelays || !bootstrapWriteRelays) {
            throw new Error('Could not get user or bootstrap relays!');
        }
        console.log('user write relays', userWriteRelays)
        console.log('bootstrap write relays', bootstrapWriteRelays)

        const queryRelaySet = NDKRelaySet.fromRelayUrls(
            [],
            ndk
        );

        userWriteRelays.forEach(
            (relay: WebSocket['url']) => queryRelaySet.addRelay(new NDKRelay(relay))
        );
        bootstrapWriteRelays.forEach(
            (relay: WebSocket['url']) => queryRelaySet.addRelay(new NDKRelay(relay))
        );

        console.log('write relay for user and bootstrap account: ', queryRelaySet);

        // user and bootstrap 'trust' basis: follows, mutes and reports
        const trustBasisFilter: NDKFilter = {
            kinds: [NDKKind.Contacts, NDKKind.MuteList, NDKKind.Report],
            authors: [user.pubkey, BTCTroubleshootPubkey]
        }

        const trustBasisEvents = await ndk.fetchEvents(
            trustBasisFilter,
            {
                groupable: false,
                closeOnEose: true,
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
            queryRelaySet,
        );

        console.log('trustBasisEvents', trustBasisEvents)

        // first order scores. Authors for the second order wot score are recorded
        const authors = updateWotScores(trustBasisEvents, true);
        console.log('authors', Array.from(authors))

        // Get a common relay set for the user's network
        //
        // The forUsers() method is bugs with many authors for some reason! 
        // const networkQueryRelayMap = await NDKRelayList.forUsers(Array.from(authors), ndk);
        const networkQueryRelaySet = NDKRelaySet.fromRelayUrls(
            [],
            ndk
        );
        for (const author of authors) {
            const relays: NDKRelayList | undefined = await NDKRelayList.forUser(author, ndk);
            if (relays) {
                relays.writeRelayUrls.forEach((r: string) => {
                    networkQueryRelaySet.addRelay(new NDKRelay(r));
                });
            }
        }

        console.log('Network query relay set: ', networkQueryRelaySet)


        // Now get ALL second order follows, mutes and reports
        const networkFilter = {
            kinds: [NDKKind.Contacts, NDKKind.MuteList, NDKKind.Report],
            authors: Array.from(authors),
        };

        console.log('authors', authors)

        const networkStore = await ndk.fetchEvents(
            networkFilter,
            {
                groupable: false,
                closeOnEose: true,
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
            networkQueryRelaySet,
        );

        console.log('Network event store', networkStore)

        // Second order scores
        updateWotScores(networkStore, false);

        followsUpdated.set(Math.floor(Date.now() / 1000));

        wotUpdated.set(true);

        console.log("Follows", get(currentUserFollows));
        console.log("Network follows", get(networkWoTScores));
    } catch (e) {
        console.log('Could not update Web of Trust scores: ', e)
    }
}

function updateWotScores(events: Set<NDKEvent>, firstOrderFollows: boolean): Set<Hexpubkey> {
    const user = get(currentUser);
    const $currentUserFollows = get(currentUserFollows);
    const $networkWoTScores = get(networkWoTScores);
    if (!user || !$currentUserFollows || !$networkWoTScores) {
        throw new Error('Could not get data to update wot scores');
    }
    const followWot = (firstOrderFollows ? firstOrderFollowWot : secondOrderFollowWot);
    const muteWot = (firstOrderFollows ? firstOrderMuteWot : secondOrderMuteWot);
    const reportWot = (firstOrderFollows ? firstOrderReportWot : secondOrderReportWot);

    const authors: Set<Hexpubkey> = new Set();

    events.forEach((event: NDKEvent)=> {
        if (event.kind === NDKKind.Contacts) {
            const follows = filterValidPTags(event.tags);
            // console.log('follows', follows)
            const userFollow:boolean = (event.pubkey === user.pubkey);
            follows.forEach((f: Hexpubkey) => {
                if (userFollow) $currentUserFollows.add(f);

                // Add first order follow score
                const currentScore:number = ($networkWoTScores as Map<Hexpubkey, number>)
                    .get(f) ?? 0;

                ($networkWoTScores as Map<Hexpubkey, number>)
                    .set(f, currentScore + followWot);
                // Register first order follows for second order follows query
                authors.add(f);
            });
            events.delete(event);
        }
    });

    events.forEach((event: NDKEvent)=> {
        if (event.kind === NDKKind.MuteList) {
            const mutes = filterValidPTags(event.tags);
            mutes.forEach((mutedPerson: Hexpubkey) => {
                const currentScore:number|undefined = ($networkWoTScores as Map<Hexpubkey, number>)
                    .get(mutedPerson);
                // Only include score if part of the follow network
                if (currentScore) {
                    // Add mute score
                    ($networkWoTScores as Map<Hexpubkey, number>)
                        .set(mutedPerson, currentScore + muteWot);
                }
            });
        } else if (event.kind === NDKKind.Report) {
            const reportedPerson = filterValidPTags(event.tags).at(0);
            if (reportedPerson) {
                // console.log('reported: ', reportedPerson)
                // const reason = event.getMatchingTags('p')[0][2];
                // console.log('for: ', reason)
                const currentScore:number|undefined = ($networkWoTScores as Map<Hexpubkey, number>)
                    .get(reportedPerson);
                // Only include score if part of the follow network
                if (currentScore) {
                    // Add report score
                    ($networkWoTScores as Map<Hexpubkey, number>)
                        .set(reportedPerson, currentScore + reportWot);
                }
            }
        }
    });


    currentUserFollows.set($currentUserFollows);
    networkWoTScores.set($networkWoTScores);

    return authors;
}

export function getWotScore(targetUser: NDKUser): number|undefined {
    const $networkWoTScores = get(networkWoTScores);

    if (!$networkWoTScores) return undefined;

    return ($networkWoTScores as Map<Hexpubkey, number>).get(targetUser.pubkey);
}

export function getWotPercentile(targetUser: NDKUser): number {
    const $networkWoTScores:Map<Hexpubkey, number> | null = get(networkWoTScores);
    if (!$networkWoTScores) return unkownWot;

    if (!$networkWoTScores.has(targetUser.pubkey)) return unkownWot;

    const wotValue = $networkWoTScores.get(targetUser.pubkey) as number;

    const wotValues:number[] = Array.from($networkWoTScores.values());

    return percentile(wotValues, wotValue);
}

export const filterValidPTags = (tags: NDKTag[]) => tags
    .filter((t: NDKTag) => t[0] === 'p')
    .map((t: NDKTag) => t[1])
    .filter((f: Hexpubkey) => {
        try {
            nip19.npubEncode(f);
            return true;
        } catch { return false; }
    });
