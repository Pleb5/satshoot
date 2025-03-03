import { writable } from 'svelte/store';

export const hideAppBarsStore = writable(false);

// This is used to display warning about experimental feature of ecash in wallet page
export const displayEcashWarning = writable(true);

export const scrollToMyJobsAndMyOffers = writable(false)
