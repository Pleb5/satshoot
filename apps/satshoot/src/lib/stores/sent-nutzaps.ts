import { derived, get } from 'svelte/store';
import ndk from '$lib/stores/session';

import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, type NDKFilter } from '@nostr-dev-kit/ndk';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

// The authors of the filter gets assigned when user is initialized
export const allSentNutzapsFilter: NDKFilter = {
    kinds: [NDKKind.Nutzap],

};

export const allSentNutzaps = get(ndk).storeSubscribe(allSentNutzapsFilter, {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
    cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
});

export const filteredSentNutzaps = derived([allSentNutzaps], ([$allSentNutzaps]) => {
    return $allSentNutzaps.filter((zap: NDKEvent) => {
        const zapTargetKind = parseInt(zap.tagValue('a')?.split(':')[0] ?? '-1');

        if (zapTargetKind === ExtendedNDKKind.FreelanceBid) {
            return true;
        } else if (zapTargetKind === ExtendedNDKKind.FreelanceOrder) {
            return true;
        }

        return false;
    });
});