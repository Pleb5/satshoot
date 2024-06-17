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
import currentUser from "./user";

import { getActiveServiceWorker } from "$lib/utils/helpers";
import { goto } from "$app/navigation";

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
            return notification.kind === BTCTroubleshootKind.Ticket;
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
            return notification.kind === BTCTroubleshootKind.Offer;
        });

        const offers: OfferEvent[] = [];
        filteredEvents.forEach((o: NDKEvent)=>{offers.push(OfferEvent.from(o))});

        return offers;
    }
);
export const messageNotifications = derived(
    [notifications, currentUser],
    ([$notifications, $currentUser]) => {

        const messages = $notifications.filter((notification: NDKEvent) => {
            const dmKind = (notification.kind === NDKKind.EncryptedDirectMessage);
            const notSentByUser = (notification.pubkey !== $currentUser.pubkey);
            return dmKind && notSentByUser;
        });

        return messages;
    }
);
export const reviewNotifications = derived(
    [notifications],
    ([$notifications]) => {

        const filteredEvents = $notifications.filter((notification: NDKEvent) => {
            return notification.kind === NDKKind.Review;
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

        let title = '';
        let body = '';
        let tag = '';
        let icon = '/satshoot.svg'

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

        const activeSW = await getActiveServiceWorker()
        if(activeSW) {
            activeSW.postMessage({
                notification: 'true',
                title: title,
                body: body,
                tag: tag,
            });
        } else {
            const options = {
                icon: icon,
                badge: icon,
                image: icon,
                body: body,
                tag: tag,
            };
            const notification = new Notification(title, options);
            notification.onclick = (e) => {
                goto('/notifications/');
            };
        }

    }
}

export default notificationsEnabled;
