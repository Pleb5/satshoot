import ndk from "./ndk";
import { type NDKFilter, type NDKSubscriptionOptions, NDKKind, NDKEvent } from '@nostr-dev-kit/ndk';

import { get } from "svelte/store";

export const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: get(ndk).pool };

// Stores ALL messages of ALL Troubleshoot sessions for a user
export const messageStoreFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    // All messages, be it bitcoiner or troubleshooter, are tagged with the ticket address
    '#t': [],
    limit: 21_000,
};

export const messageStore = get(ndk).storeSubscribe(messageStoreFilter, subOptions);
