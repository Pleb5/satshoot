import { type NDKUser, type Hexpubkey, type NDKEvent, NDKKind, NDKList } from '@nostr-dev-kit/ndk';
import { derived, writable } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

import { filterValidPTags } from '../utils/misc';
import { LoginMethod } from '$lib/stores/session';
import { fetchEventFromRelaysFirst } from '../utils/misc';

export enum UserMode {
    Freelancer,
    Client,
}

export const userMode: Writable<UserMode> = persisted<UserMode>('userMode', UserMode.Freelancer);

export const loginAlert = writable(true);

export const mounted = writable(false);

export const onBoarding = persisted('onBoarding', false, {storage: 'session'});
export const onBoardingName = persisted('onBoardingName', '', {storage: 'session'})
export const onBoardingNsec = persisted('onBoardingNsec', '', {storage: 'session'})

export const loggingIn = writable(false);
export const loggedIn = writable(false);
export const loginMethod: Writable<LoginMethod | null> = persisted('login-method', null);

export const followsUpdated: Writable<number> = persisted('followsUpdated', 0);

const currentUser = writable<NDKUser | null>(null);

export const freelanceFollowSets = writable(new Map<Hexpubkey, NDKList>());

export const currentUserFreelanceFollows = derived(
    [freelanceFollowSets, currentUser],
    ([$freelanceFollowsEvents, $currentUser]) => {
        const pubKeySet: Set<Hexpubkey> = new Set();

        if ($currentUser) {
            const currentUserFollowSet = $freelanceFollowsEvents.get($currentUser.pubkey);
            if (currentUserFollowSet) {
                const follows = filterValidPTags(currentUserFollowSet.tags);
                follows.forEach((f) => pubKeySet.add(f));
            }
        }
        return pubKeySet;
    }
);

export const fetchFreelanceFollowSet = async (pubkey: Hexpubkey): Promise<NDKEvent | null> => {
    const followSet = await fetchEventFromRelaysFirst(
        {
            kinds: [NDKKind.FollowSet],
            authors: [pubkey],
            '#d': ['freelance'],
        },
        {
            fallbackToCache: true,
            relayTimeoutMS: 3000,
        }
    );

    if (followSet) {
        freelanceFollowSets.update((map) => {
            const followList = NDKList.from(followSet);
            map.set(pubkey, followList);
            return map;
        });
    }

    return followSet;
};

export default currentUser;
