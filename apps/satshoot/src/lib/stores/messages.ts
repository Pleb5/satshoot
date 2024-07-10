import ndk from "./ndk";
import {
    type NDKFilter,
    type NDKSubscriptionOptions,
    NDKKind, 
    type NDKEvent, 
    type NDKTag
} from '@nostr-dev-kit/ndk';

import { get, writable, derived } from "svelte/store";
import { wot } from "./wot";
import { BTCTroubleshootKind } from "$lib/events/kinds";


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
            let relatedToTicket = false;
            message.tags.forEach((tag: NDKTag) => {
                if (tag[0] === 't' && tag[1]
                        .includes(BTCTroubleshootKind.Ticket.toString())
                ) {
                    relatedToTicket = true;
                }
            });

            if (!relatedToTicket) return false;

            if ( !($wot.has(message.pubkey)) ) return false;

            return true;
        });

        return feed;
    }
);

export const offerMakerToSelect = writable<string>('');
export const selectedPerson = writable<string>('');
