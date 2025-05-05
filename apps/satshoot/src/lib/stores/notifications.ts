import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';
import { getSetSerializer } from '$lib//utils/misc';
import { get } from 'svelte/store';
import { type NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { JobEvent } from '$lib/events/JobEvent';
import { OfferEvent } from '$lib/events/OfferEvent';
import { ReviewEvent } from '$lib/events/ReviewEvent';
import currentUser from './user';

import { getActiveServiceWorker, orderEventsChronologically } from '$lib/utils/helpers';
import { goto } from '$app/navigation';

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
        return notification.kind === NDKKind.FreelanceJob;
    });

    const jobs: JobEvent[] = [];
    filteredEvents.forEach((t: NDKEvent) => {
        jobs.push(JobEvent.from(t));
    });

    orderEventsChronologically(jobs);

    return jobs;
});

export const offerNotifications = derived([notifications], ([$notifications]) => {
    const filteredEvents = $notifications.filter((notification: NDKEvent) => {
        return notification.kind === NDKKind.FreelanceOffer;
    });

    const offers: OfferEvent[] = [];
    filteredEvents.forEach((o: NDKEvent) => {
        offers.push(OfferEvent.from(o));
    });

    orderEventsChronologically(offers);

    return offers;
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
    // Check for zap kinds and if zap has an 'a' tag referring to an Offer
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
    if (!$seenIDs.has(event.id)) {
        $seenIDs.add(event.id);
        seenIDs.set($seenIDs);
        $notifications.push(event);
        notifications.set($notifications);

        const $readNotifications = get(readNotifications);
        // Browser notifications are disabled or the notification is already read
        if (!get(browserNotificationsEnabled) || $readNotifications.has(event.id)) {
            return;
        }

        let title = '';
        let body = '';
        let tag = '';
        const icon = '/satshoot.svg';

        // The Job of our _Offer_ was updated
        if (event.kind === NDKKind.FreelanceJob) {
            title = 'Update!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.FreelanceJob.toString();
            // The Offer on our _Job_ was updated
        } else if (event.kind === NDKKind.FreelanceOffer) {
            title = 'Update!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.FreelanceOffer.toString();
        } else if (event.kind === NDKKind.EncryptedDirectMessage) {
            title = 'New Message!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.EncryptedDirectMessage.toString();
        } else if (event.kind === NDKKind.Review) {
            title = 'Someone left a Review!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.Review.toString();
        } else if (event.kind === NDKKind.Zap) {
            title = 'Payment arrived!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.Zap.toString();
        } else if (event.kind === NDKKind.KindScopedFollow) {
            title = 'Someone has followed you!';
            body = '🔔 Check your Notifications!';
            tag = NDKKind.KindScopedFollow.toString();
        }

        const activeSW = await getActiveServiceWorker();
        if (activeSW) {
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

export default browserNotificationsEnabled;
