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
const subOptions: NDKSubscriptionOptions = { closeOnEose: false, pool: get(ndk).pool };

export const tickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
            = get(ndk).storeSubscribe(ticketFilter, subOptions, TicketEvent);

// The filter's pubkey part will be filled in when user logs in
export const myTicketFilter: NDKFilter<BTCTroubleshootKind> = {kinds: [BTCTroubleshootKind.Ticket], authors: [], limit:1000};

// The filter's pubkey part will be filled in when user logs in
export const myOfferFilter: NDKFilter<BTCTroubleshootKind> = {kinds: [BTCTroubleshootKind.Offer], authors: [], limit:1000};

export const myTickets:NDKEventStore<ExtendedBaseType<TicketEvent>>
        = get(ndk).storeSubscribe(myTicketFilter, subOptions, TicketEvent);

export const myOffers:NDKEventStore<ExtendedBaseType<OfferEvent>>
        = get(ndk).storeSubscribe(myOfferFilter, subOptions, OfferEvent);


export function startMySubscriptions(pubkey: string) {
    myTicketFilter.authors?.push(pubkey);
    myOfferFilter.authors?.push(pubkey);

    console.log('added author to myTicketFilter, starting subs...',myTicketFilter)


    myTickets.startSubscription();
    myOffers.startSubscription();

    console.log('started subscriptions!')

    console.log(myTickets)
    console.log(myOffers)


}

export function stopMySubscriptions() {
    console.log('unsubscribing from mytickets and myoffers')

    if (myTickets && myOffers) {
        myTickets.unsubscribe();
        myOffers.unsubscribe();

        myTicketFilter.authors = [];
        myOfferFilter.authors = [];

        console.log('unsubbed from mytickets and myoffers')
        console.log(myTickets)
        console.log(myOffers)

        console.log()
    }
}
