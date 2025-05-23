import { persisted } from 'svelte-persisted-store';
import { writable } from 'svelte/store';

// This is used to display warning about experimental feature of ecash in wallet page
export const displayEcashWarning = writable(true);

export const scrollToMyJobsAndMyBids = writable(false);
export const redirectAfterLogin = writable(true);

export enum OnboardingStep {
    Account_Created,
    Profile_Updated,
    Relays_Configured,
}

export const onboardingStep = writable<OnboardingStep | null>(null);

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
