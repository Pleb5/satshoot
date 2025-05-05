import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';
import { JobStatus } from '$lib/events/JobEvent';
import { OfferStatus } from '$lib/events/OfferEvent';

const tabStore: Writable<number> = persisted('tabStore', 0);

export const jobTabStore: Writable<number> = persisted('jobTabStore', JobStatus.New);
export const offerTabStore: Writable<number> = persisted('offerTabStore', OfferStatus.Pending);

export enum ProfilePageTabs {
    Jobs,
    Offers,
}

export const profileTabStore = writable<ProfilePageTabs>(ProfilePageTabs.Jobs);

export default tabStore;
