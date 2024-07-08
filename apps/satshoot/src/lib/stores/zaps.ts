import { get, derived } from 'svelte/store';
import ndk from '$lib/stores/ndk';
import { wot } from '$lib/stores/wot';

import {
    NDKKind,
    type NDKFilter,
    type NDKEvent,
} from '@nostr-dev-kit/ndk';

export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
};

export const allReceivedZapsFilter: NDKFilter<NDKKind.Zap> = {
    kinds: [NDKKind.Zap],
};

export const allReceivedZaps = get(ndk).storeSubscribe(
    allReceivedZapsFilter,
    subOptions,
);

export const wotFilteredReceivedZaps = derived(
    [wot, allReceivedZaps],
    ([$wot, $allReceivedZaps]) => {
        return $allReceivedZaps.filter((z: NDKEvent) => {
            return $wot.has(z.pubkey);
        });
    }
);

