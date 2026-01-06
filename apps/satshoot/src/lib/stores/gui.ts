import { persisted } from 'svelte-persisted-store';
import { writable } from 'svelte/store';

// This is used to display warning about experimental feature of ecash in wallet page
export const displayEcashWarning = writable(true);

export const scrollToMyJobsAndMyBids = writable(false);
export const redirectAfterLogin = writable(true);

export const wotToggleOnJobsFeed = persisted('wotToggleOnJobsFeed', true);
export const wotToggleOnServicesFeed = persisted('wotToggleOnJobsFeed', true);

export const servicesFilter = persisted('servicesFilter', {
    active: true,
    inActive: false,
});

export const ordersFilter = persisted('ordersFilter', {
    pending: true,
    inProgress: false,
    completed: false,
});

export const jobFilter = persisted('jobFilter', {
    new: true,
    inProgress: false,
    closed: false,
});

export const bidFilter = persisted('bidFilter', {
    pending: true,
    success: false,
    lost: false,
});

export enum NotificationTabs {
    Follows,
    Zaps,
    Jobs,
    Services,
    Messages,
    Reviews,
}

export const selectedNotificationTab = persisted(
    'selectedNotificationTab',
    NotificationTabs.Follows
);
