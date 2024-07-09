import ndk from "./ndk";
import {
    type NDKFilter,
    type NDKSubscriptionOptions,
    NDKKind, 
    type NDKEvent 
} from '@nostr-dev-kit/ndk';

import { get, writable, derived } from "svelte/store";
import { wot } from "./wot";


export interface Message {
    id: string;
    sender: string,
    recipient: string;
    timestamp: string;
    message: string;
    ticket?: string;
}

export const subOptions: NDKSubscriptionOptions = { closeOnEose: false };

export const receivedMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    '#p' : [],
    limit: 50_000,
};

export const sentMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    // set to user as soon as login happens
    authors: [],
    limit: 50_000,
}

export const messageStore = get(ndk).storeSubscribe(
    [receivedMessageFilter, sentMessageFilter], subOptions
);
// Filter messages by wot. Question: is this necessary? After login the user 
// web of trust is set for the [authors] filter anywway so messages should already
// be filtered on the relay side. Client side filtering might be unnecessary this way.
export const wotFilteredMessageFeed = derived(
    [messageStore, wot],
    ([$messageStore, $wot]) => {
        // console.log('wotFilteredMessageFeed', wotFilteredMessageFeed)
        const feed = $messageStore.filter((message: NDKEvent) => {
            if (
                // Filter messages if they are in the web of trust
                $wot.has(message.pubkey) 
            ) {
                return true;
            } 

            return false;
        });

        return feed;
    }
);

export const offerMakerToSelect = writable<string>('');
export const selectedPerson = writable<string>('');
