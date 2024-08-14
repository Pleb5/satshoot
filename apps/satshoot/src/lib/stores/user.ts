import type { NDKUser, Hexpubkey } from '@nostr-dev-kit/ndk';
import { writable } from 'svelte/store';
import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';

import { getSetSerializer } from '../utils/misc';


export const loginAlert = writable(true);

export const mounted = writable(false);
export const loggingIn = writable(false);
export const loggedIn = writable(false);
export const retryUserInit = localStorageStore('retryUserInit', false);

export const currentUserFollows: Writable<Set<Hexpubkey> | null>
    = localStorageStore('currentUserFollows', null, {serializer: getSetSerializer()});

export const userRelaysUpdated = writable(false);
export const followsUpdated: Writable<number> = localStorageStore('followsUpdated', 0);

const currentUser = writable<NDKUser|null>(null);

export default currentUser;
