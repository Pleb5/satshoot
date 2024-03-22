import ndk from "./ndk";
import { type NDKFilter, type NDKSubscriptionOptions, NDKKind } from '@nostr-dev-kit/ndk';

import { get, writable } from "svelte/store";

import type { Prompt } from '$lib/components/messages';

export const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: get(ndk).pool };

// Stores ALL messages of ALL Troubleshoot sessions for a user
export const receivedMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
    kinds: [NDKKind.EncryptedDirectMessage],
    // All messages, be it bitcoiner or troubleshooter, are tagged with the ticket address
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

// Message Prompt is sort of a hack: it needs to be in the App footer(layout AppShell)
// to always stay at the bottom of the page, while the chat remains scrollable
// AND the last message is visible regardless of screen sizes
// Therefore, the variables used in the Prompt must be accessible from the messages page
// despite it being inserted into the DOM in layout.svelte.
// This is achieved via storing all necessary variables in these globally accessible stores
// and setting the store values later, when the User navigates to the chat
export const promptStore = writable<Prompt>();
export const currentMessage = writable('');
export const onPromptKeyDown = writable<(event: KeyboardEvent) => void>();
export const sendMessage = writable<() => void>();
export const hide = writable(true);
