import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';
import { getSetSerializer } from '$lib//utils/misc';
import { get } from 'svelte/store';
import { type NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';
import { ReviewEvent } from '$lib/events/ReviewEvent';
import currentUser from './user';

import { getActiveServiceWorker, orderEventsChronologically } from '$lib/utils/helpers';
import { goto } from '$app/navigation';
import { OrderEvent } from '$lib/events/OrderEvent';

export const browserNotificationsEnabled: Writable<boolean> = persisted(
    'browserNotificationsEnabled',
    true
);

export const serviceWorkerRegistrationFailed = persisted('serviceWorkerRegFailed', false);

export const seenIDs = writable<Set<string>>(new Set());

export const notifications = writable<NDKEvent[]>([]);

export const readNotifications: Writable<Set<string>> = persisted('readNotifications', new Set(), {
    serializer: getSetSerializer(),
});

export const unReadNotifications = derived(
    [notifications, readNotifications],
    ([$notifications, $readNotifications]) => {
        return $notifications.filter((notification) => !$readNotifications.has(notification.id));
    }
);

export const jobNotifications = derived([notifications], ([$notifications]) => {
    const filteredEvents = $notifications.filter((notification: NDKEvent) => {
        return (
            notification.kind === NDKKind.FreelanceJob || notification.kind === NDKKind.FreelanceBid
        );
    });

    const events: (JobEvent | BidEvent)[] = [];
    filteredEvents.forEach((e: NDKEvent) => {
        const event = e.kind === NDKKind.FreelanceJob ? JobEvent.from(e) : BidEvent.from(e);
        events.push(event);
    });

    orderEventsChronologically(events);

    return events;
});

export const serviceNotifications = derived([notifications], ([$notifications]) => {
    const filteredEvents = $notifications.filter(
        (notification: NDKEvent) => notification.kind === NDKKind.FreelanceOrder
    );

    const orders: OrderEvent[] = [];
    filteredEvents.forEach((o: NDKEvent) => {
        orders.push(OrderEvent.from(o));
    });

    orderEventsChronologically(orders);

    return orders;
});

export const messageNotifications = derived(
    [notifications, currentUser],
    ([$notifications, $currentUser]) => {
        let messages: NDKEvent[] = [];
        if ($currentUser) {
            messages = $notifications.filter((notification: NDKEvent) => {
                const dmKind = notification.kind === NDKKind.EncryptedDirectMessage;
                const notSentByUser = notification.pubkey !== $currentUser.pubkey;
                return dmKind && notSentByUser;
            });
        }

        orderEventsChronologically(messages);

        return messages;
    }
);

export const reviewNotifications = derived([notifications], ([$notifications]) => {
    const filteredEvents = $notifications.filter((notification: NDKEvent) => {
        return notification.kind === NDKKind.Review;
    });

    const reviews: ReviewEvent[] = [];
    filteredEvents.forEach((r: NDKEvent) => {
        reviews.push(ReviewEvent.from(r));
    });

    orderEventsChronologically(reviews);

    return reviews;
});

export const receivedZapsNotifications = derived([notifications], ([$notifications]) => {
    // Check for zap kinds and if zap has an 'a' tag referring to an Bid
    const filteredEvents = $notifications.filter((notification: NDKEvent) => {
        return notification.kind === NDKKind.Zap || notification.kind === NDKKind.Nutzap;
    });

    orderEventsChronologically(filteredEvents);

    return filteredEvents;
});

export const followNotifications = derived([notifications], ([$notifications]) => {
    const filteredEvents = $notifications.filter((notification: NDKEvent) => {
        return notification.kind === NDKKind.KindScopedFollow;
    });

    orderEventsChronologically(filteredEvents);

    return filteredEvents;
});

export async function sendNotification(event: NDKEvent) {
    const $seenIDs = get(seenIDs);
    const $notifications = get(notifications);

    if ($seenIDs.has(event.id)) return;

    $seenIDs.add(event.id);
    seenIDs.set($seenIDs);

    $notifications.push(event);
    notifications.set($notifications);

    const $readNotifications = get(readNotifications);
    if (!get(browserNotificationsEnabled) || $readNotifications.has(event.id)) return;

    const icon = '/satshoot.svg';

    let title = '';
    let body = '';
    let tag = '';

    switch (event.kind) {
        case NDKKind.FreelanceJob:
        case NDKKind.FreelanceBid:
        case NDKKind.FreelanceOrder:
            title = 'Update!';
            body = '🔔 Check your Notifications!';
            tag = event.kind.toString();
            break;
        case NDKKind.EncryptedDirectMessage:
            title = 'New Message!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.EncryptedDirectMessage.toString();
            break;
        case NDKKind.Review:
            title = 'Someone left a Review!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.Review.toString();
            break;
        case NDKKind.Zap:
            title = 'Payment arrived!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.Zap.toString();
            break;
        case NDKKind.KindScopedFollow:
            title = 'Someone has followed you!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.KindScopedFollow.toString();
            break;
    }

    const activeSW = await getActiveServiceWorker();
    if (activeSW) {
        activeSW.postMessage({ notification: 'true', title, body, tag });
    } else {
        const options = { icon, badge: icon, image: icon, body, tag };
        const notification = new Notification(title, options);
        notification.onclick = () => goto('/notifications/');
    }
}

export default browserNotificationsEnabled;
