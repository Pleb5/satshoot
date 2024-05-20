import type { 
    NDKSigner, NDKEvent,
    NDKRelay, NDKSubscription,
    NDKUser, Hexpubkey,
    NDKFilter,
    NDKTag,
} from '@nostr-dev-kit/ndk';

import { NDKSubscriptionCacheUsage, NDKRelaySet } from '@nostr-dev-kit/ndk';

import type { NDKSvelte, NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';

import { TicketEvent } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import {
    loggedIn,
    currentUserFollows,
    networkFollows,
    minWot,
    firstOrderFollowWot,
    secondOrderFollowWot,
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
        const $networkFollows = get(networkFollows) as Map<Hexpubkey, number>;
        console.log('networkFollows: ', $networkFollows)
        const networkSize:number = $networkFollows?.size ?? 0; 

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
    if (user) {
        const $networkFollows = new Map<Hexpubkey, number>();
        const $currentUserFollows = new Set<Hexpubkey>();

        const follows = await user.follows(undefined, true);
        const authors: string[] = [];
        for(const f of follows) {
            $currentUserFollows.add(f.pubkey);

            $networkFollows.set(f.pubkey, firstOrderFollowWot);

            authors.push(f.pubkey);

        };

        // Now get ALL other follows of people the user follows
        const networkFollowsFilter: NDKFilter = {
            kinds: [3],
            authors: authors,
        }
        const kind3RelaySet = NDKRelaySet.fromRelayUrls(["wss://purplepag.es"], ndk);

        const networkFollowsStore = await ndk.fetchEvents(
            networkFollowsFilter,
            {
                groupable: false,
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
            kind3RelaySet,
        );

        // Process all network follows and update the wot scores in the map
        networkFollowsStore.forEach((event: NDKEvent) => {
            const follows = filterValidPTags(event.tags);
            follows.forEach((f: Hexpubkey) => {
                const currentScore:number = $networkFollows.get(f) ?? 0;
                $networkFollows.set(f, currentScore + secondOrderFollowWot);
            });
        });

        currentUserFollows.set($currentUserFollows);
        networkFollows.set($networkFollows);

        followsUpdated.set(Math.floor(Date.now() / 1000));

        wotUpdated.set(true);

        console.log("Follows", $currentUserFollows);
        console.log("Network follows", $networkFollows);
    }
    
}

export function getWotScore(targetUser: NDKUser): number|undefined {
    const $networkFollows = get(networkFollows);
    // 
    if (!$networkFollows) return undefined;

    return $networkFollows.get(targetUser.pubkey);
}

export function getWotPercentile(targetUser: NDKUser): number {
    const $networkFollows:Map<Hexpubkey, number> | null = get(networkFollows);
    if (!$networkFollows) return 0;

    if (!$networkFollows.has(targetUser.pubkey)) return 0;

    const wotValue = $networkFollows.get(targetUser.pubkey) as number;

    const wotValues:number[] = Array.from($networkFollows.values());

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
