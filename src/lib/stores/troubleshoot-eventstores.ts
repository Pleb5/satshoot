import ndk from './ndk.ts';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';

import { BTCTroubleshootKind } from '$lib/events/kinds';
import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import { get } from "svelte/store";

// Export necessary when restarting a subscription with a new filter
export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    pool: get(ndk).pool,
    groupable: false,
    autoStart: false,
};

const allTicketsFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
};

// Tickets that MY Offers(as a TroubleShooter) reference
// <Ticket #d tag> == <my offer.referencedTicketAddress third part>
// #a: "<kind>:<pubkey>:<d-tag>"
export const ticketsOfMyOffersFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
    '#d': [],
};


// ALL Offers on defined tickets
// Offer '#a' tag == ticket.ticketAddress
export const offersOfMyTicketsFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Offer],
    '#a': [],
};

// The filter's pubkey part will be filled in when user logs in
export const myTicketFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
    authors: [],
};

// The filter's pubkey part will be filled in when user logs in
export const myOfferFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Offer], 
    authors: [], 
};
export const allTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe<TicketEvent>(allTicketsFilter, subOptions, TicketEvent);

export const ticketsOfMyOffers:NDKEventStore<ExtendedBaseType<TicketEvent>>
= get(ndk).storeSubscribe<TicketEvent>(ticketsOfMyOffersFilter, subOptions, TicketEvent);

export const offersOfMyTickets:NDKEventStore<ExtendedBaseType<OfferEvent>>
        = get(ndk).storeSubscribe<OfferEvent>(offersOfMyTicketsFilter, subOptions, OfferEvent);

export const myTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe<TicketEvent>(myTicketFilter, subOptions, TicketEvent);

export const myOffers:NDKEventStore<ExtendedBaseType<OfferEvent>>
        = get(ndk).storeSubscribe<OfferEvent>(myOfferFilter, subOptions, OfferEvent);

