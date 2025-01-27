import { TicketEvent } from '$lib/events/TicketEvent';
import { writable } from 'svelte/store';

export const jobToEdit = writable<TicketEvent | null>(null);
