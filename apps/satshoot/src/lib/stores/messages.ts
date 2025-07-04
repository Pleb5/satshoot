import ndk from '$lib/stores/session';
import {
    type NDKFilter,
    type NDKSubscriptionOptions,
    NDKKind,
    type NDKEvent,
    type NDKTag,
} from '@nostr-dev-kit/ndk';

import { get, writable, derived } from 'svelte/store';
import { wot } from './wot';

export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    groupable: false,
};

export const receivedMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    '#p': [],
    limit: 50_000,
};

export const sentMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    // set to user as soon as login happens
    authors: [],
    limit: 50_000,
};

export const messageStore = get(ndk).storeSubscribe(
    [receivedMessageFilter, sentMessageFilter],
    subOptions
);
// Filter messages by wot. Question: is this necessary? After login the user
// web of trust is set for the [authors] filter anywway so messages should already
// be filtered on the relay side. Client side filtering might be unnecessary this way.
export const wotFilteredMessageFeed = derived([messageStore, wot], ([$messageStore, $wot]) => {
    // console.log('wotFilteredMessageFeed', wotFilteredMessageFeed)
    const feed = $messageStore.filter((message: NDKEvent) => {
        let relatedToFreelance = false;
        message.tags.forEach((tag: NDKTag) => {
            if (
                tag[0] === 'a' &&
                tag[1].includes(NDKKind.FreelanceJob.toString() || NDKKind.FreelanceJob.toString())
            ) {
                relatedToFreelance = true;
            }
        });

        if (!relatedToFreelance) return false;

        if (!$wot.has(message.pubkey)) return false;

        return true;
    });

    return feed;
});
