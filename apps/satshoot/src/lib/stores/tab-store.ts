import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';
import { TicketStatus } from '$lib/events/TicketEvent';
import { OfferStatus } from '$lib/events/OfferEvent';

const tabStore: Writable<number> = persisted('tabStore', 0);

export const ticketTabStore: Writable<number> = persisted('ticketTabStore', TicketStatus.New);
export const offerTabStore: Writable<number> = persisted('offerTabStore', OfferStatus.Pending);

export enum ProfilePageTabs {
    Jobs,
    Offers,
}

export const profileTabStore = writable<ProfilePageTabs>(ProfilePageTabs.Jobs);

export default tabStore;
