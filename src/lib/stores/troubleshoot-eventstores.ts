import ndk from './ndk.ts';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';

import { BTCTroubleshootKind } from '$lib/events/kinds';
import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import { get } from "svelte/store";

// Export necessary when restarting a subscription with a new filter
export const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: get(ndk).pool };

const newTicketsFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
    '#s': [TicketStatus.New.toString()],
    limit: 5000,
};

// Need to check for "In progress" or "Closed" status to remove from new tickets when ticket changes
const oldTicketsFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
    '#s': [TicketStatus.InProgress.toString(), TicketStatus.Closed.toString()],
    limit: 1000,
};

// Tickets that MY Offers(as a TroubleShooter) reference
// <Ticket #d tag> == <my offer.referencedTicketAddress third part>
// #a: "<kind>:<pubkey>:<d-tag>"
export const ticketsOfSpecificOffersFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
    '#d': [],
    limit:10000,
};


// ALL Offers on defined tickets
// Offer '#a' tag == ticket.ticketAddress
export const offersOnTicketsFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Offer],
    '#a': [],
    limit:20000
};

// The filter's pubkey part will be filled in when user logs in
export const myTicketFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
    authors: [],
    limit:10000
};

// The filter's pubkey part will be filled in when user logs in
export const myOfferFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Offer], 
    authors: [], 
    limit:10000
};
export const newTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe<TicketEvent>(newTicketsFilter, subOptions, TicketEvent);

export const oldTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe<TicketEvent>(oldTicketsFilter, subOptions, TicketEvent);

export let ticketsOfSpecificOffers:NDKEventStore<ExtendedBaseType<TicketEvent>>
= get(ndk).storeSubscribe<TicketEvent>(ticketsOfSpecificOffersFilter, subOptions, TicketEvent);

export let offersOnTickets:NDKEventStore<ExtendedBaseType<OfferEvent>>
        = get(ndk).storeSubscribe<OfferEvent>(offersOnTicketsFilter, subOptions, OfferEvent);

export const myTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe<TicketEvent>(myTicketFilter, subOptions, TicketEvent);

export const myOffers:NDKEventStore<ExtendedBaseType<OfferEvent>>
        = get(ndk).storeSubscribe<OfferEvent>(myOfferFilter, subOptions, OfferEvent);

