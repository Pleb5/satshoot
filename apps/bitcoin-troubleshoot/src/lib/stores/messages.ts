import ndk from "./ndk";
import { type NDKFilter, type NDKSubscriptionOptions, NDKKind, type NDKUser } from '@nostr-dev-kit/ndk';

import { get, writable } from "svelte/store";



export const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: get(ndk).pool };

// Stores ALL messages of ALL Troubleshoot sessions for a user
export const receivedMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    // All messages, be it client or troubleshooter, are tagged with the ticket address
    '#t': [],
    '#p' : [],
    limit: 21_000,
};

export const myMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    authors: [],
    '#t': [],
    limit: 21_000,
}

export const messageStore = get(ndk).storeSubscribe([receivedMessageFilter, myMessageFilter], subOptions);

export const offerMakerToSelect = writable<string>('');
export const selectedPerson = writable<string>('');
