/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files } from '$service-worker';

import { NDKKind } from '@nostr-dev-kit/ndk';

const sw = self as unknown as ServiceWorkerGlobalScope;
let openAllowed = true;

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

async function openNotificationWindow(tag: string) {
    const urlToVisit = '/notifications/';

    const ticketNotification = 
        (tag === NDKKind.FreelanceTicket.toString());
    const offerNotification = 
        (tag === NDKKind.FreelanceOffer.toString());
    const messageNotification = 
        (tag === NDKKind.EncryptedDirectMessage.toString());
    const reviewNotification = 
        (tag === NDKKind.Review.toString());
    const receivedZapNotification = 
        (tag === NDKKind.Zap.toString());

    if(
        !ticketNotification 
        && !offerNotification
        && !messageNotification 
        && !reviewNotification
        && !receivedZapNotification
    ) {
        console.log('This type of notification is not implemented yet!')
        return;
    }

    // let clientOpenWithUrl = false;
    //
    //
    // for(const client of allClients) {
    //     const url = new URL(client.url);
    //     console.log('client url:', client.url)
    //     console.log('compare', url.pathname)
    //     if(url.pathname.includes(urlToVisit)) {
    //         console.log('client already there with url')
    //         await client.focus();
    //         clientOpenWithUrl = true;
    //         break;
    //     }
    // }
    // if (!clientOpenWithUrl) {
    // }

    const allClients = await sw.clients.matchAll({type: "window"});
    if (allClients.length === 0) {
        await sw.clients.openWindow(urlToVisit);
    } else {
        await allClients[0].focus();
    }
}

sw.onnotificationclick = (event: NotificationEvent) => {
    event.notification.close();
    if (openAllowed) {
        openAllowed = false;
        event.waitUntil(openNotificationWindow(event.notification.tag));
        openAllowed = true;
    }
}

sw.onmessageerror = (me) => {
    console.log('Message error:', me);
};

sw.onerror = (e) => {
    console.log("Error happened in Service Worker:", e.message)
};

