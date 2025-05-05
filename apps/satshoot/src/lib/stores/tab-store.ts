import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';
import { JobStatus } from '$lib/events/JobEvent';
import { BidStatus } from '$lib/events/BidEvent';

const tabStore: Writable<number> = persisted('tabStore', 0);

export const jobTabStore: Writable<number> = persisted('jobTabStore', JobStatus.New);
export const bidTabStore: Writable<number> = persisted('bidTabStore', BidStatus.Pending);

export enum ProfilePageTabs {
    Jobs,
    Bids,
}

export const profileTabStore = writable<ProfilePageTabs>(ProfilePageTabs.Jobs);

export default tabStore;
