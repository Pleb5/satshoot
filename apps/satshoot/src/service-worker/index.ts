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
    ...files, // everything in `static`
];

console.log(sw);

sw.oninstall = () => {
    sw.skipWaiting();
};

sw.onactivate = (event: ExtendableEvent) => {
    event.waitUntil(sw.clients.claim());
    console.log('Service Worker activated');
};

sw.onmessage = (m) => {
    const title = m.data['title'];
    const body = m.data['body'];
    const tag = m.data['tag'];
    if (m.data['notification'] && title && body && tag) {
        const granted = Notification.permission === 'granted';
        if (granted) {
            const options = {
                icon: '/satshoot.svg',
                badge: '/satshoot.svg',
                image: '/satshoot.svg',
                body: body,
                tag: tag,
            };

            sw.registration.showNotification(title, options);
        } else {
            console.log('Notification not permitted! Dont try to show updates!');
        }
    } else {
        console.log('Unexpected message in Service Worker: ', m);
        console.log('title', m.data['title']);
        console.log('body', m.data['body']);
        console.log('tag', m.data['tag']);
        console.log('notification', m.data['notification']);
    }
};

async function openNotificationWindow(tag: string) {
    const urlToVisit = '/notifications/';

    const jobNotification = tag === NDKKind.FreelanceJob.toString();
    const offerNotification = tag === NDKKind.FreelanceOffer.toString();
    const messageNotification = tag === NDKKind.EncryptedDirectMessage.toString();
    const reviewNotification = tag === NDKKind.Review.toString();
    const receivedZapNotification = tag === NDKKind.Zap.toString();
    const followNotification = tag === NDKKind.KindScopedFollow.toString();

    if (
        !jobNotification &&
        !offerNotification &&
        !messageNotification &&
        !reviewNotification &&
        !receivedZapNotification &&
        !followNotification
    ) {
        console.log('This type of notification is not implemented yet!');
        return;
    }

    const allClients = await sw.clients.matchAll({ type: 'window' });
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
};

sw.onmessageerror = (me) => {
    console.log('Message error:', me);
};

sw.onerror = (e) => {
    console.log('Error happened in Service Worker:', e.message);
};
