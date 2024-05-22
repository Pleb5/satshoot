import type { Hexpubkey, NDKEvent } from '@nostr-dev-kit/ndk';
import { writable, get, derived } from 'svelte/store';
import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';

import { getMapSerializer, BTCTroubleshootPubkey } from '../utils/misc';
export const networkWoTScores: Writable<Map<Hexpubkey, number> | null>
    = localStorageStore('networkWoTScores', null, {serializer: getMapSerializer()});

// Minimum wot to be included in any result
export const minWot = writable(3);

// WoT scores for follows, mutes and reports
export const firstOrderFollowWot = 4;
export const firstOrderMuteWot = -0.5*(firstOrderFollowWot);
export const firstOrderReportWot = -0.5*(firstOrderFollowWot);
export const secondOrderFollowWot = 1;
export const secondOrderMuteWot = -0.5*(secondOrderFollowWot);
export const secondOrderReportWot = -0.5*(secondOrderFollowWot);

export const bootstrapAccount = BTCTroubleshootPubkey;

export const wotUpdated = writable(false);

export const wot = derived(
    [networkWoTScores, minWot],
    ([$networkWoTScores, $minWot]) => {
        const pubkeys = new Set<Hexpubkey>();

        $networkWoTScores?.forEach((score: number, follow: Hexpubkey) => {
            if (score >= $minWot) pubkeys.add(follow);
        });

        return pubkeys;
    }
);

export function wotFiltered(events: NDKEvent[]):NDKEvent[] {
    const $wot = get(wot);

    const filteredEvents: NDKEvent[] = [];

    for (const e of events) {
        if ($wot.has(e.pubkey)) filteredEvents.push(e);
    }

    return filteredEvents;
}
