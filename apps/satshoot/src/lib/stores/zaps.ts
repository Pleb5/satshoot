import { get, derived } from 'svelte/store';
import ndk from '$lib/stores/session';

import { NDKKind, type NDKFilter, type NDKEvent } from '@nostr-dev-kit/ndk';
import { myBids } from './freelance-eventstores';
import type { BidEvent } from '$lib/events/BidEvent';

// The p-tag of the filter gets assigned when user is initialized
export const allReceivedZapsFilter: NDKFilter = {
    kinds: [NDKKind.Zap, NDKKind.Nutzap],
};

export const allReceivedZaps = get(ndk).storeSubscribe(allReceivedZapsFilter, {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
});

// todo: use wot here too
export const filteredReceivedZaps = derived(
    [allReceivedZaps, myBids],
    ([$allReceivedZaps, $myBids]) => {
        // filter zaps that arrived on my bids
        return $allReceivedZaps.filter((z: NDKEvent) => {
            let myBidZapped = false;
            for (const bid of $myBids as BidEvent[]) {
                const eventId = z.tagValue('e');
                if (eventId === bid.id) {
                    myBidZapped = true;
                    break;
                }
            }

            return myBidZapped;
        });
    }
);
