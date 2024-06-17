/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files } from '$service-worker';

import { BTCTroubleshootKind } from '../lib/events/kinds.ts';
import { NDKKind } from '@nostr-dev-kit/ndk';

const sw = self as unknown as ServiceWorkerGlobalScope;

const ASSETS = [
    ...build, // the app itself	
    ...files  // everything in `static`
];

console.log(sw)

sw.oninstall = () => {
    sw.skipWaiting();
}

sw.onactivate = (event: ExtendableEvent) => {
    event.waitUntil(sw.clients.claim());
    console.log('Service Worker activated')
}

sw.onmessage = (m) => {
    console.log('message received in service worker', m)
    const title = m.data['title'];
    const body = m.data['body'];
    const tag = m.data['tag'];
    if (m.data['notification'] && title && body && tag) {
        const granted = Notification.permission === 'granted';
        if(granted) {
            const options = { 
                icon: '/satshoot.svg',
                badge: '/satshoot.svg',
                image: '/satshoot.svg',
                body: body,
                tag: tag,
            }

            sw.registration.showNotification(title, options);
        } else {
            console.log('Notification not permitted! Dont try to show updates!')
        }
    } else {
        console.log('Unexpected message in Service Worker: ', m);
        console.log('title', m.data['title'])
        console.log('body', m.data['body'])
        console.log('tag', m.data['tag'])
        console.log('notification', m.data['notification'])
    }
};

sw.onnotificationclick = async(event: NotificationEvent) => {
    const urlToVisit = '/notifications/';

    const ticketNotification = 
        (event.notification.tag === BTCTroubleshootKind.Ticket.toString());
    const offerNotification = 
        (event.notification.tag === BTCTroubleshootKind.Offer.toString());
    const messageNotification = 
        (event.notification.tag === NDKKind.EncryptedDirectMessage.toString());
    const reviewNotification = 
        (event.notification.tag === NDKKind.Review.toString());

    if(!ticketNotification && !offerNotification
        && !messageNotification && !reviewNotification) {
        console.log('This type of notification is not implemented yet!')
        return;
    }

    let clientOpenWithUrl = false;

    const allClients = await sw.clients.matchAll({type: "window"});
    for(const client of allClients) {
        const url = new URL(client.url);
        if(url.pathname.includes('urlToVisit')) {
            client.focus();
            clientOpenWithUrl = true;
            break;
        }
    }

    if (!clientOpenWithUrl) {
        sw.clients.openWindow(urlToVisit);
    }
}

sw.onmessageerror = (me) => {
    console.log('Message error:', me);
};

sw.onerror = (e) => {
    console.log("Error happened in Service Worker:", e.message)
};

