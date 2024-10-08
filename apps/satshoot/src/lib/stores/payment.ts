import type { OfferEvent } from '$lib/events/OfferEvent';
import { TicketEvent } from '$lib/events/TicketEvent';
import { writable } from 'svelte/store';

export const paymentDetail = writable<{
    ticket: TicketEvent;
    offer: OfferEvent;
} | null>(null);
