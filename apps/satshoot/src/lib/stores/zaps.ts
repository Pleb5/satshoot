import { get, derived } from 'svelte/store';
import ndk from '$lib/stores/ndk';

import {
    NDKKind,
    type NDKFilter,
    type NDKEvent,
} from '@nostr-dev-kit/ndk';
import { myOffers } from './freelance-eventstores';
import type { OfferEvent } from '$lib/events/OfferEvent';

// The p-tag of the filter gets assigned when user is initialized 
export const allReceivedZapsFilter = {
    kinds: [NDKKind.Zap, NDKKind.Nutzap],
};

export const allReceivedZaps = get(ndk).storeSubscribe(
    allReceivedZapsFilter,
    {
        closeOnEose: false,
        groupable: false,
        autoStart: false,
    },
);

// todo: use wot here too
export const filteredReceivedZaps = derived(
    [allReceivedZaps, myOffers],
    ([$allReceivedZaps, $myOffers]) => {
        // filter zaps that arrived on my offers
        return $allReceivedZaps.filter((z: NDKEvent) => {
            let myOfferZapped = false;
            for (const offer of $myOffers as OfferEvent[]) {
                const eventId = z.tagValue('e');
                if (eventId === offer.id) {
                    myOfferZapped = true;
                    break;
                }
            }

            return myOfferZapped;
        });
    }
);

