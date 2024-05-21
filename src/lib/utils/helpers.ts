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

        let queryRelayMap = await NDKRelayList.forUsers([user.pubkey, BTCTroubleshootPubkey], ndk);
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
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
            queryRelaySet,
        );

        console.log('trustBasisEvents', trustBasisEvents)

        // first order scores. Authors for the second order wot score are recorded
        const authors = updateWotScores(trustBasisEvents, true);
        console.log('authors', Array.from(authors))

        // Get a common relay set for the user's network
        // const aauthors = [ "472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e", "d04ecf33a303a59852fdb681ed8b412201ba85d8d2199aec73cb62681d62aa90", "c4749eee89ec7ba7f6432e340e033422324c063f68e550fc1b17c3c71ab4be8f", "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9", "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93", "aac07d95089ce6adf08b9156d43c1a4ab594c6130b7dcb12ec199008c5819a2f", "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245", "e1ff3bfdd4e40315959b08b4fcc8245eaa514637e1d4ec2ae166b743341be1af", "ba2f394833658475e91680b898f9be0f1d850166c6a839dbe084d0266ad6e20a", "ef151c7a380f40a75d7d1493ac347b6777a9d9b5fa0aa3cddb47fc78fab69a8b"];
        // const networkQueryRelayMap = await NDKRelayList.forUsers(
        //     ['472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e',
        //     "d04ecf33a303a59852fdb681ed8b412201ba85d8d2199aec73cb62681d62aa90"], ndk);
        
        const networkQueryRelayMap = await NDKRelayList.forUsers(Array.from(authors), ndk);
        console.log('network relay map', networkQueryRelayMap)

        const networkQueryRelaySet = NDKRelaySet.fromRelayUrls(
            [],
            ndk
        );

        Array.from(networkQueryRelayMap.values()).forEach((relayList: NDKRelayList) => {
            relayList.writeRelayUrls.forEach(
                (relay: WebSocket['url']) => networkQueryRelaySet.addRelay(new NDKRelay(relay))
            );
        });

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
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
            networkQueryRelaySet,
        );

        console.log('Network event store', networkStore)

        // Second order scores
        updateWotScores(networkStore, false);

        followsUpdated.set(Math.floor(Date.now() / 1000));

        wotUpdated.set(true);

        console.log("Follows", $currentUserFollows);
        console.log("Network follows", $networkWoTScores);
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
            console.log('follows', follows)
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
        }

        if (event.kind === NDKKind.MuteList) {
            const mutes = filterValidPTags(event.tags);
            mutes.forEach((f: Hexpubkey) => {
                // Add first order mute score
                const currentScore:number = ($networkWoTScores as Map<Hexpubkey, number>)
                    .get(f) ?? 0;
                ($networkWoTScores as Map<Hexpubkey, number>)
                    .set(f, currentScore + muteWot);
            });
        }

        if (event.kind === NDKKind.Report) {
            const reportedPerson = filterValidPTags(event.tags).at(0);
            if (reportedPerson) {
                const currentScore:number = ($networkWoTScores as Map<Hexpubkey, number>)
                    .get(reportedPerson) ?? 0;
                ($networkWoTScores as Map<Hexpubkey, number>)
                    .set(reportedPerson, currentScore + reportWot);
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
    if (!$networkWoTScores) return 0;

    if (!$networkWoTScores.has(targetUser.pubkey)) return 0;

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
