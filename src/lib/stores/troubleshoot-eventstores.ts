import ndk from './ndk.ts';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';

import { BTCTroubleshootKind } from '$lib/events/kinds';
import { TicketEvent } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import { get } from "svelte/store";

// Create a subscription that is running all the time,
// watching for troubleshoot ticket and offer events
const ticketFilter: NDKFilter<BTCTroubleshootKind> = {kinds: [BTCTroubleshootKind.Ticket], limit:1000};
const offerFilter: NDKFilter<BTCTroubleshootKind> = {kinds: [BTCTroubleshootKind.Offer], limit:1000};
const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: get(ndk).pool };

export const tickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
            = get(ndk).storeSubscribe(ticketFilter, subOptions, TicketEvent);

export const offers:NDKEventStore<ExtendedBaseType<OfferEvent>>
            = get(ndk).storeSubscribe(offerFilter, subOptions, OfferEvent);
