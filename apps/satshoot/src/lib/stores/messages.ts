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
}

export const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: get(ndk).pool };

// Stores ALL messages of ALL Troubleshoot sessions for a user
export const receivedMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    // All messages, be it client or troubleshooter, are tagged with the ticket address
    '#p' : [],
    limit: 21_000,
};

export const myMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    authors: [],
    limit: 21_000,
}

export const messageStore = get(ndk).storeSubscribe([receivedMessageFilter, myMessageFilter], subOptions);
// Filter messages by wot 
export const wotFilteredMessageFeed = derived(
    [messageStore, wot],
    ([$messageStore, $wot]) => {
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
