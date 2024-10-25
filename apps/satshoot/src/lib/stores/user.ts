import type { NDKUser, Hexpubkey } from '@nostr-dev-kit/ndk';
import { writable } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

import { getSetSerializer } from '../utils/misc';
import { type LoginMethod } from '$lib/stores/ndk';


export const loginAlert = writable(true);

export const mounted = writable(false);
export const loggingIn = writable(false);
export const loggedIn = writable(false);
export const loginMethod = writable<LoginMethod | null>(null);

export const currentUserFollows: Writable<Set<Hexpubkey> | null>
    = persisted('currentUserFollows', null, {serializer: getSetSerializer()});

export const userRelaysUpdated = writable(false);
export const followsUpdated: Writable<number> = persisted('followsUpdated', 0);

const currentUser = writable<NDKUser|null>(null);

export default currentUser;
