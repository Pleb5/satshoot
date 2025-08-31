import { get, derived } from 'svelte/store';
import ndk from '$lib/stores/session';

import { NDKKind, type NDKFilter, type NDKEvent } from '@nostr-dev-kit/ndk';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

// The p-tag of the filter gets assigned when user is initialized
export const allReceivedZapsFilter: NDKFilter = {
    kinds: [NDKKind.Zap, NDKKind.Nutzap],
};

export const allReceivedZaps = get(ndk).storeSubscribe(allReceivedZapsFilter, {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
});

export const filteredReceivedZaps = derived([allReceivedZaps], ([$allReceivedZaps]) => {
    return $allReceivedZaps.filter((zap: NDKEvent) => {
        let bidZapped = false;
        let orderZapped = false;

        const zapTargetKind = parseInt(zap.tagValue('a')?.split(':')[0] ?? '-1');

        if (zapTargetKind === ExtendedNDKKind.FreelanceBid) {
            bidZapped = true;
        } else if (zapTargetKind === ExtendedNDKKind.FreelanceOrder) {
            orderZapped = true;
        }

        return bidZapped || orderZapped;
    });
});
