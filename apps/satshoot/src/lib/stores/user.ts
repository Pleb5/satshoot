import {
    type NDKUser,
    type Hexpubkey,
    type NDKEvent,
    NDKKind,
    NDKSubscriptionCacheUsage,
} from '@nostr-dev-kit/ndk';
import { derived, get, writable } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

import { filterValidPTags } from '../utils/misc';
import ndk, { LoginMethod } from '$lib/stores/ndk';

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
        if (!$currentUser) return null;

        const currentUserFollowEvent = $freelanceFollowsEvents.get($currentUser.pubkey);
        if (!currentUserFollowEvent) return null;

        const follows = filterValidPTags(currentUserFollowEvent.tags);
        return new Set(follows);
    }
);

export const fetchFreelanceFollowEvent = async (pubkey: Hexpubkey) => {
    const $freelanceFollowEvents = get(freelanceFollowEvents);
    if ($freelanceFollowEvents.has(pubkey)) return;

    const $ndk = get(ndk);

    const followEvent = await $ndk
        .fetchEvent(
            {
                kinds: [NDKKind.KindScopedFollow],
                '#k': [NDKKind.FreelanceTicket.toString(), NDKKind.FreelanceOffer.toString()],
                authors: [pubkey],
            },
            {
                cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
            }
        )
        .catch((err) => {
            console.error(
                'Error occurred in fetching freelance follow event for user',
                pubkey,
                err
            );
            return null;
        });

    if (followEvent) {
        freelanceFollowEvents.update((map) => {
            map.set(pubkey, followEvent);
            return map;
        });
    }
};

export default currentUser;
