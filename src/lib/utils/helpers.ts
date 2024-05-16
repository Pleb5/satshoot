import type { 
    NDKSigner, NDKEvent,
    NDKRelay, NDKSubscription,
    NDKUser, Hexpubkey
} from '@nostr-dev-kit/ndk';

import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';

import { TicketEvent } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import {
    loggedIn,
    currentUserFollows,
    networkFollows,
    minWot,
    firstOrderFollowWot,
    secondOrderFollowWot,
    followsUpdated,
} from '../stores/login';
import currentUser from '../stores/login';
import notificationsEnabled from '$lib/stores/notifications';

import { get } from "svelte/store";
import { dev } from '$app/environment';

import { 
    myTicketFilter, myOfferFilter, myTickets, myOffers,
    ticketsOfMyOffers, offersOfMyTickets,
} from "$lib/stores/troubleshoot-eventstores";

import { BTCTroubleshootKind } from '$lib/events/kinds';

export async function initializeUser(ndk: NDK) {
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
    const $networkFollows = get(networkFollows);
    console.log('networkFollows: ', $networkFollows)
    const networkSize:number = $networkFollows?.size ?? 0; 

    const $followsUpdated = get(followsUpdated);
    const twoWeeksAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 14;

    if (networkSize < 1000 || $followsUpdated < twoWeeksAgo) {
        console.log(networkSize)
        updateFollowsAndWotScore();
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

export async function updateFollowsAndWotScore() {
    const user = get(currentUser);
    if (user) {
        const $networkFollows = new Map<Hexpubkey, number>();
        const $currentUserFollows = new Set<Hexpubkey>();

        const follows = await user.follows(undefined, true);
        for(const f of follows) {
            $currentUserFollows.add(f.pubkey);

            $networkFollows.set(f.pubkey, firstOrderFollowWot);

            const followsOfFollow = await f.follows(undefined, true);
            followsOfFollow.forEach((distantFollow: NDKUser) => {
                const currentScore:number = $networkFollows.get(distantFollow.pubkey) ?? 0;
                $networkFollows.set(distantFollow.pubkey, currentScore + secondOrderFollowWot);
            });
        };

        currentUserFollows.set($currentUserFollows);
        networkFollows.set($networkFollows);

        followsUpdated.set(Math.floor(Date.now() / 1000));

        console.log("Follows", $currentUserFollows);
        console.log("Network follows", $networkFollows);
    }
    
}

export function getWotScore(targetUser: NDKUser): number {
    const $networkFollows = get(networkFollows);
    if (!$networkFollows) return minWot;

    return $networkFollows.get(targetUser.pubkey) || minWot;
}
