import { writable } from 'svelte/store';
import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import type { NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';
import { BTCTroubleshootKind } from '$lib/events/kinds';
export const INITIALRELAYURLS = [
    "wss://purplepag.es/",
    "wss://relay.nostr.band/",
    "wss://nos.lol/",
    "wss://relay.snort.social/",
    "wss://relay.damus.io/",
]


export const ndkStore = new NDKSvelte({
    explicitRelayUrls: INITIALRELAYURLS,
    outboxRelayUrls: ["wss://purplepag.es"],
    enableOutboxModel: false,
});

await ndkStore.connect()
console.log("NDK Connected");

// Create a subscription that is running all the time,
// watching for troubleshoot ticket and offer events
const filter: NDKFilter<BTCTroubleshootKind> = {kinds: [BTCTroubleshootKind.Ticket, BTCTroubleshootKind.Offer]};
const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: ndkStore.pool };

export const ticketEventStore:NDKEventStore<ExtendedBaseType<TicketEvent>> = ndkStore.storeSubscribe(filter, subOptions);
export const offerEventStore:NDKEventStore<ExtendedBaseType<OfferEvent>> = ndkStore.storeSubscribe(filter, subOptions);

// Create a singleton instance that is the default export
const ndk = writable(ndkStore);

export default ndk;
