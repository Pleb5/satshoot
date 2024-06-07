// import ndk from "./ndk";
import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';
import { getSetSerializer } from '$lib//utils/misc';
import { get } from "svelte/store";
import { type NDKEvent, NDKKind, type NDKFilter } from "@nostr-dev-kit/ndk";
import { BTCTroubleshootKind } from "$lib/events/kinds";
// import { 
//     reviewsOnMyOffersFilter,
//     reviewsOnMyTicketsFilter
// } from './reviews';
// import {
//     ticketsOfMyOffersFilter,
//     offersOfMyTicketsFilter,
// } from "./troubleshoot-eventstores";
// import { 
//     myMessageFilter,
//     receivedMessageFilter,
// } from './messages';

import { getActiveServiceWorker } from "$lib/utils/helpers";

export const notificationsEnabled: Writable<boolean> = localStorageStore('notificationsEnabled', false) ;

export const seenIDs: Writable<Set<string>> = localStorageStore(
    'seenIDs',
    new Set(),
    {serializer: getSetSerializer()}
);

// export const notificationsFilters: Array<NDKFilter<BTCTroubleshootKind | NDKKind>> = [
//     ticketsOfMyOffersFilter,
//     offersOfMyTicketsFilter,
//     myMessageFilter,
//     receivedMessageFilter,
//     reviewsOnMyTicketsFilter,
//     reviewsOnMyOffersFilter,
//
// ];
//
export async function sendNotification(event: NDKEvent) {
    const $seenIDs = get(seenIDs);
    if(get(notificationsEnabled) 
        && !$seenIDs.has(event.id)
    ) {
        $seenIDs.add(event.id);
        seenIDs.set($seenIDs);
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
        } else if (event.kind === NDKKind.EncryptedDirectMessage) {
            title = 'Message arrived!';
            body = 'Check your Messages!';
            tag = NDKKind.EncryptedDirectMessage.toString();
        } else if (event.kind === NDKKind.Review) {
            title = 'Someone left a Review!';
            body = 'Check your Reviews!';
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

// export default notifications;
