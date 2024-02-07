import { BTCTroubleshootKind } from "./kinds";
import { NDKEvent, type NDK, type NostrEvent } from "@nostr-dev-kit/ndk";

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
    MilestoneBased = 2,
}

export class OfferEvent extends NDKEvent {
    private _status: OfferStatus;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= BTCTroubleshootKind.Offer;
    }

    static from(event:NDKEvent){
        return new OfferEvent(event.ndk, event.rawEvent());
    }

    get offerAddress(): string {
        return this.tagAddress();
    }

    // this.generateTags() will take care of setting d-tag

    get referencedTicketAddress(): string | undefined {
        return this.tagValue("a");
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
    }

    // No milestones based approach yet
    get pricing(): Pricing | undefined {
        return parseInt(this.tagValue("pricing") as string);
    }

    set pricing(pricing: Pricing) {
        this.removeTag('pricing');
        console.log('removed default pricing tag from offer, setting a new one...')
        this.tags.push(['pricing', pricing.toString()]);
    }

    get amount(): number | undefined {
        return parseInt(this.tagValue("amount") as string);
    }

    set amount(amount: number) {
        this.removeTag('amount');
        this.tags.push(['amount', amount.toString()]);
    }

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }

}
