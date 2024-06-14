// import ndk from "./ndk";
import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';
import { derived, writable } from "svelte/store";
import { getSetSerializer } from '$lib//utils/misc';
import { get } from "svelte/store";
import { type NDKEvent, NDKKind } from "@nostr-dev-kit/ndk";
import { BTCTroubleshootKind } from "$lib/events/kinds";
import { TicketEvent } from "$lib/events/TicketEvent";
import { OfferEvent } from "$lib/events/OfferEvent";
import { ReviewEvent } from "$lib/events/ReviewEvent";

import { getActiveServiceWorker } from "$lib/utils/helpers";

export const notificationsEnabled: Writable<boolean> = localStorageStore('notificationsEnabled', false) ;

export const seenIDs: Writable<Set<string>> = localStorageStore(
    'seenIDs',
    new Set(),
    {serializer: getSetSerializer()}
);

export const notifications = writable<NDKEvent[]>([]);
export const ticketNotifications = derived(
    [notifications],
    ([$notifications]) => {

        const filteredEvents = $notifications.filter((notification: NDKEvent) => {
            return notification.kind = BTCTroubleshootKind.Ticket;
        });

        const tickets: TicketEvent[] = [];
        filteredEvents.forEach((t: NDKEvent)=>{tickets.push(TicketEvent.from(t))});

        return tickets;
    }
);
export const offerNotifications = derived(
    [notifications],
    ([$notifications]) => {

        const filteredEvents = $notifications.filter((notification: NDKEvent) => {
            return notification.kind = BTCTroubleshootKind.Offer;
        });

        const offers: OfferEvent[] = [];
        filteredEvents.forEach((o: NDKEvent)=>{offers.push(OfferEvent.from(o))});

        return offers;
    }
);
export const messageNotifications = derived(
    [notifications],
    ([$notifications]) => {

        const messages = $notifications.filter((notification: NDKEvent) => {
            return notification.kind = NDKKind.EncryptedDirectMessage;
        });

        return messages;
    }
);
export const reviewNotifications = derived(
    [notifications],
    ([$notifications]) => {

        const filteredEvents = $notifications.filter((notification: NDKEvent) => {
            return notification.kind = NDKKind.Review;
        });

        const reviews: ReviewEvent[] = [];
        filteredEvents.forEach((r: NDKEvent)=>{reviews.push(ReviewEvent.from(r))});

        return reviews;
    }
);

export async function sendNotification(event: NDKEvent) {
    const $seenIDs = get(seenIDs);
    const $notifications = get(notifications);
    if(get(notificationsEnabled) 
        && !$seenIDs.has(event.id)
    ) {
        $seenIDs.add(event.id);
        seenIDs.set($seenIDs);
        $notifications.push(event);
        notifications.set($notifications);

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
            body = 'Check your Notifications!';
            tag = BTCTroubleshootKind.Ticket.toString();
            // The Offer on our _Ticket_ was updated
        } else if(event.kind === BTCTroubleshootKind.Offer) {
            title = 'Ticket update arrived!';
            body = 'Check your Notifications!';
            tag = BTCTroubleshootKind.Offer.toString();
        } else if (event.kind === NDKKind.EncryptedDirectMessage) {
            title = 'Message arrived!';
            body = 'Check your Notifications!';
            tag = NDKKind.EncryptedDirectMessage.toString();
        } else if (event.kind === NDKKind.Review) {
            title = 'Someone left a Review!';
            body = 'Check your Notifications!';
            tag = NDKKind.Review.toString();
        }

        activeSW.postMessage({
            notification: 'true',
            title: title,
            body: body,
            tag: tag,
        });
    }
}

export default notificationsEnabled;
