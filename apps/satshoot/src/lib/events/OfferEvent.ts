import { BTCTroubleshootKind } from "./kinds";
import { NDKEvent, type NDK, type NostrEvent } from "@nostr-dev-kit/ndk";

// Offer Status is implicitly set by the TicketEvent referenced by this offer's 'a' tag.
// When ticket updates its 'a' tag, ALL offers statuses change that referenced this ticket
export enum OfferStatus {
    Pending = 0, // No 'a' tag present in TicketEvent
    Won = 1, // TicketEvent references this event in its 'a' tag
    Lost = 2, // TicketEvent references a different OfferEvent
}

export enum Pricing {
    Absolute = 0,
    SatsPerMin = 1,
    // This has been postponed
    // MilestoneBased = 2,
}

export class OfferEvent extends NDKEvent {
    private _pricing: Pricing;
    private _amount: number;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= BTCTroubleshootKind.Offer;
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

    get referencedTicketDTag(): string | undefined {
        const aTag = this.tagValue('a');
        if (!aTag) return undefined;

        return aTag.split(':')[2];
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
}
