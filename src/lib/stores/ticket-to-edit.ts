import { TicketEvent } from "$lib/events/TicketEvent";
import { writable } from "svelte/store";

export const ticketToEdit = writable<TicketEvent | null>(null);
