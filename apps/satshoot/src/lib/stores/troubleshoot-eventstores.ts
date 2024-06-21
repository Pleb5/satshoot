import ndk from './ndk.ts';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import type {  NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';

import { BTCTroubleshootKind } from '$lib/events/kinds';
import { TicketEvent } from '$lib/events/TicketEvent';
import { OfferEvent } from '$lib/events/OfferEvent';

import { wot } from '$lib/stores/wot';

import { get, derived } from "svelte/store";

// Export necessary when restarting a subscription with a new filter
export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
};

export const allTicketsFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
};

export const allOffersFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Offer],
};

// The filter's pubkey part will be filled in when user logs in
export const myTicketFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Ticket],
};

// The filter's pubkey part will be filled in when user logs in
export const myOfferFilter: NDKFilter<BTCTroubleshootKind> = {
    kinds: [BTCTroubleshootKind.Offer], 
};
export const allTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe<TicketEvent>(allTicketsFilter, subOptions, TicketEvent);

export const allOffers:NDKEventStore<ExtendedBaseType<OfferEvent>>
        = get(ndk).storeSubscribe<OfferEvent>(allOffersFilter, subOptions, OfferEvent);


export const wotFilteredTickets = derived(
    [allTickets, wot],
    ([$allTickets, $wot]) => {
        const tickets = $allTickets.filter((ticket: TicketEvent) => {
            if (
                // Filter messages if they are in the web of trust
                $wot.has(ticket.pubkey) 
            ) {
                return true;
            } 

            return false;
        });

        return tickets;
    }
);

export const wotFilteredOffers = derived(
    [allOffers, wot],
    ([$allOffers, $wot]) => {
        const offers = $allOffers.filter((offer: OfferEvent) => {
            if (
                // Filter messages if they are in the web of trust
                $wot.has(offer.pubkey) 
            ) {
                return true;
            } 

            return false;
        });

        return offers;
    }
);

export const myTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe<TicketEvent>(myTicketFilter, subOptions, TicketEvent);

export const myOffers:NDKEventStore<ExtendedBaseType<OfferEvent>>
        = get(ndk).storeSubscribe<OfferEvent>(myOfferFilter, subOptions, OfferEvent);

