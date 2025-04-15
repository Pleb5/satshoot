import {
    type NDKUser,
    type Hexpubkey,
    type NDKEvent,
    NDKKind,
} from '@nostr-dev-kit/ndk';
import { derived, writable } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

import { filterValidPTags } from '../utils/misc';
import { LoginMethod } from '$lib/stores/session';
import { fetchEventFromRelaysFirst } from '../utils/misc';

export const loginAlert = writable(true);

export const mounted = writable(false);
export const loggingIn = writable(false);
export const loggedIn = writable(false);
export const loginMethod = writable<LoginMethod | null>(null);

export const followsUpdated: Writable<number> = persisted('followsUpdated', 0);

const currentUser = writable<NDKUser | null>(null);

export const freelanceFollowEvents = writable(new Map<Hexpubkey, NDKEvent>());

export const currentUserFreelanceFollows = derived(
    [freelanceFollowEvents, currentUser],
    ([$freelanceFollowsEvents, $currentUser]) => {
        const pubKeySet: Set<Hexpubkey> = new Set();

        if ($currentUser) {
            const currentUserFollowEvent = $freelanceFollowsEvents.get(
                $currentUser.pubkey
            );
            if (currentUserFollowEvent) {
                const follows = filterValidPTags(currentUserFollowEvent.tags);
                follows.forEach((f) => pubKeySet.add(f))
            }
        }
        return pubKeySet;
    }
);

export const fetchFreelanceFollowEvent = async (pubkey: Hexpubkey)
: Promise<NDKEvent | null> => {
    const followEvent = await fetchEventFromRelaysFirst(
        {
            kinds: [NDKKind.KindScopedFollow],
            '#k': [NDKKind.FreelanceTicket.toString(), NDKKind.FreelanceOffer.toString()],
            authors: [pubkey],
        },
        {
            fallbackToCache: true,
            relayTimeoutMS: 3000,
        }
    );

    if (followEvent) {
        freelanceFollowEvents.update((map) => {
            map.set(pubkey, followEvent);
            return map;
        });
    }

    return followEvent;
};

export default currentUser;
