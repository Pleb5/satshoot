import { get, derived } from 'svelte/store';
import ndk from '$lib/stores/ndk';
import { wot } from '$lib/stores/wot';

import {
    NDKKind,
    type NDKFilter,
    type NDKEvent,
} from '@nostr-dev-kit/ndk';

export const allReceivedZapsFilter: NDKFilter<NDKKind.Zap> = {
    kinds: [NDKKind.Zap],
};

export const allReceivedZaps = get(ndk).storeSubscribe(
    allReceivedZapsFilter,
    {
        closeOnEose: false,
        groupable: false,
        autoStart: false,
    },
);

export const wotFilteredReceivedZaps = derived(
    [wot, allReceivedZaps],
    ([$wot, $allReceivedZaps]) => {
        // console.log('wotFilteredReceivedZaps', $allReceivedZaps)
        return $allReceivedZaps.filter((z: NDKEvent) => {
            // Check zappee(zap sender, who initiatied the zap request,
            // NOT the zapper pubkey!
            const zapper = z.tagValue('P');
            if (!zapper) {
                return false;
            }
            return $wot.has(zapper);
        });
    }
);

