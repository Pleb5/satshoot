import type { NDKUser, Hexpubkey } from '@nostr-dev-kit/ndk';
import { writable } from 'svelte/store';
import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';

import { getSetSerializer, getMapSerializer } from '../utils/misc';

export const loginAlert = writable(true);

export const loggedIn = writable(false);

export const currentUserFollows: Writable<Set<Hexpubkey> | null>
    = localStorageStore('currentUserFollows', null, {serializer: getSetSerializer()});

export const networkFollows: Writable<Map<Hexpubkey, number> | null>
    = localStorageStore('networkFollows', null, {serializer: getMapSerializer()});

export const minWot = 0;
export const firstOrderFollowWot = 4;
export const secondOrderFollowWot = 1;

export const wotUpdated = writable(false);
export const followsUpdated: Writable<number> = localStorageStore('followsUpdated', 0);

const currentUser = writable<NDKUser|null>(null);

export default currentUser;
