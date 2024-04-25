import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';
import { TicketStatus } from "$lib/events/TicketEvent";
import { OfferStatus } from "$lib/events/OfferEvent";

const tabStore: Writable<number> = localStorageStore('tabStore', 0) ;

export const ticketTabStore: Writable<number> = localStorageStore(
    'ticketTabStore', TicketStatus.New
);
export const offerTabStore: Writable<number> = localStorageStore(
    'offerTabStore', OfferStatus.Pending
);

export default tabStore;
