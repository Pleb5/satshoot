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

export const filteredMessages = derived(
    [messageStore, wot], ([$messageStore, $wot]) => {
    const feed = $messageStore.filter((message: NDKEvent) => {
        let relatedToFreelance = false;
        message.tags.forEach((tag: NDKTag) => {
            if (
                tag[0] === 'a' &&
                (
                    tag[1].includes(NDKKind.FreelanceJob.toString())
                    || tag[1].includes(NDKKind.FreelanceService.toString())
                )
            ) {
                relatedToFreelance = true;
            }
        });

        if (!relatedToFreelance) return false;

        // wot filtering removed from messages for now
        // if (!$wot.has(message.pubkey)) return false;

        return true;
    });

    return feed;
});
