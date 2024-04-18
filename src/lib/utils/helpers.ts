import NDK from '@nostr-dev-kit/ndk';
import type { 
    NDKSigner, NDKEvent,
    NDKRelay, NDKSubscription,
} from '@nostr-dev-kit/ndk';

import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';

import { TicketEvent } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import { loggedIn } from '../stores/login';
import currentUser from '../stores/login';
import notificationsEnabled from '$lib/stores/notifications';

import { get } from "svelte/store";
import { dev } from '$app/environment';

import { 
    myTicketFilter, myOfferFilter, myTickets, myOffers,
    ticketsOfSpecificOffers, offersOnTickets,
    offersOnTicketsFilter, ticketsOfSpecificOffersFilter
} from "$lib/stores/troubleshoot-eventstores";

import { BTCTroubleshootKind } from '$lib/events/kinds';

export async function initializeUser(ndk: NDK) {
    const user = await (ndk.signer as NDKSigner).user();
    if (user.npub) {
        loggedIn.set(true);
    } else return;

    currentUser.set(user);

    // --------------- User Subscriptions -------------- //
    myTicketFilter.authors?.push(user.pubkey);
    myOfferFilter.authors?.push(user.pubkey);

    myTickets.startSubscription();
    myOffers.startSubscription();

    myTickets.subscription?.on('event',
        (event: NDKEvent) => {
            const ticket = TicketEvent.from(event);
            if (!offersOnTicketsFilter['#a']?.includes(ticket.ticketAddress)) {
                offersOnTicketsFilter['#a']?.push(ticket.ticketAddress);
                /// Set filter, restart offer sub.
                restartEventStoreWithNotification(offersOnTickets);
            }
        }
    );

    myOffers.subscription?.on('event',
        (event: NDKEvent) => {
            const offer = OfferEvent.from(event);
            const dTagOfTicket = offer.referencedTicketAddress.split(':')[2] as string;
            if (!ticketsOfSpecificOffersFilter['#d']?.includes(dTagOfTicket)) {
                ticketsOfSpecificOffersFilter['#d']?.push(dTagOfTicket);
                /// Set filter, restart ticket sub.
                restartEventStoreWithNotification(ticketsOfSpecificOffers);
            }
        }
    );



    // --------- Notifications based on User Subscriptions and Relevant Tickets/Offers -------- //

    // TODO: check what events are added to ticketsOfSpecificOffers and offersOnTickets!
    // Everything might not be relevant!
    // Start listening to #a and #d tags based on mytickets and myoffers HERE
    ticketsOfSpecificOffers.startSubscription();
    offersOnTickets.startSubscription();

    requestNotifications( 
        (ticketsOfSpecificOffers as NDKEventStore<ExtendedBaseType<TicketEvent>>).subscription!
    );

    requestNotifications( 
        (offersOnTickets as NDKEventStore<ExtendedBaseType<OfferEvent>>).subscription!
    );


    // --------- User Profile --------------- //

    await user.fetchProfile();
    currentUser.set(user);
}

export function restartEventStoreWithNotification<NDKEventStore>(store: NDKEventStore) {
    store.unsubscribe();
    store.startSubscription();
    requestNotifications(store.subscription);
}

function requestNotifications(subscription: NDKSubscription) {
    console.log('requesting notifications...', subscription)
    subscription.on("event", 
        async (event: NDKEvent, r: NDKRelay, subscription: NDKSubscription) => {
            // Check for new unique events not served from cache
            console.log('checking notificationsEnabled')
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

