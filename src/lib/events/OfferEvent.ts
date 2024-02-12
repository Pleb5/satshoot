import { BTCTroubleshootKind } from "./kinds";
import { NDKEvent, NDKRelaySet, type NDK, type NostrEvent } from "@nostr-dev-kit/ndk";
import type { NDKSvelte } from "@nostr-dev-kit/ndk-svelte";
import { nip19 } from "nostr-tools";
import { TicketEvent } from "./TicketEvent";

// This is implicitly set by the TicketEvent referenced by this offer's 'a' tag.
// When ticket updates its 'a' tag, the accepted offer status also changes
export enum OfferStatus {
    Pending = 0, // No 'a' tag present in TicketEvent
    Won = 1, // TicketEvent references this event in its 'a' tag
    Lost = 2, // TicketEvent references a different OfferEvent
}

export enum Pricing {
    SatsPerMin = 0,
    Absolute = 1,
    // This has been postponed
    MilestoneBased = 2,
}

export class OfferEvent extends NDKEvent {
    private _status: OfferStatus;
    private _pricing: Pricing;
    private _amount: number;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= BTCTroubleshootKind.Offer;
        this._status = parseInt(this.tagValue('status') as string);
        this._pricing = parseInt(this.tagValue('pricing') as string);
        this._amount = parseInt(this.tagValue("amount") as string);
    }

    static from(event:NDKEvent){
        return new OfferEvent(event.ndk, event.rawEvent());
    }

    get offerAddress(): string {
        return this.tagAddress();
    }

    // this.generateTags() will take care of setting d-tag

    get referencedTicketAddress(): string {
        return this.tagValue("a") as string;
    }

    set referencedTicketAddress(referencedTicketAddress: string) {
        // Can only have exactly one accepted offer tag
        this.removeTag('a');
        this.tags.push(['a', referencedTicketAddress]);
    }

    get status():OfferStatus {
        return this._status;
    }

    set status(status: OfferStatus) {
        this._status = status;
        this.removeTag('status');
        this.tags.push(['status', status.toString()]);
    }

    // No milestones based approach yet
    get pricing(): Pricing {
        return this._pricing;
    }

    set pricing(pricing: Pricing) {
        this._pricing = pricing;
        this.removeTag('pricing');
        this.tags.push(['pricing', pricing.toString()]);
    }

    get amount(): number {
        return this._amount;
    }

    set amount(amount: number) {
        this._amount = amount;
        this.removeTag('amount');
        this.tags.push(['amount', amount.toString()]);
    }

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }

    public async getTicket(ndk: NDKSvelte): Promise<TicketEvent | null> {
        if (!ndk) {
            throw new Error('NDK is null, cannot fetch event for Offer!');
        }

        
        const bech32ID: string = nip19.naddrEncode({
            kind: BTCTroubleshootKind.Ticket,
            pubkey: this.referencedTicketAddress.split(':')[1] as string,
            identifier: this.referencedTicketAddress.split(':')[2] as string,
        });

        const event = await ndk.fetchEvent(
            bech32ID,
            {},
            new NDKRelaySet(new Set(ndk.pool.relays.values()), ndk)); 

        let ticket: TicketEvent | null = null;
        if (event) {
            ticket = TicketEvent.from(event);
        }
        return ticket;
    }

}
