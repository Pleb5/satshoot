import { BTCTroubleshootKind } from "./kinds";
import { NDKEvent, NDKRelaySet, type NDK, type NostrEvent } from "@nostr-dev-kit/ndk";
import type { NDKFilter } from "@nostr-dev-kit/ndk";
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
    // MilestoneBased = 2,
}

export class OfferEvent extends NDKEvent {
    private _status: OfferStatus;
    private _pricing: Pricing;
    private _amount: number;

    private _ticket: TicketEvent | null;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= BTCTroubleshootKind.Offer;
        this._status = parseInt(this.tagValue('status') as string);
        this._pricing = parseInt(this.tagValue('pricing') as string);
        this._amount = parseInt(this.tagValue("amount") as string);
        this._ticket = null;

        // Todo: This needs to happen from outside of offerevent/TicketEvent
        // GUI update problem...
        // Readd fetchTicket/fetchOffers one-off call for resource saving?

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

    get ticket(): TicketEvent | null {
        return this._ticket;
    }

    public async startTicketSub(): Promise<TicketEvent | null> {

        return new Promise((resolve) => {
            if (this.ndk) {
                const filter: NDKFilter = {
                    kinds: [BTCTroubleshootKind.Ticket as number],
                    authors: [this.referencedTicketAddress.split(':')[1] as string],
                    '#d': [this.referencedTicketAddress.split(':')[2] as string],
                };
                const sub = this.ndk.subscribe(
                    filter,
                    {},
                    new NDKRelaySet(new Set(this.ndk.pool.relays.values()), this.ndk)
                );

                sub.on("event", (e: NDKEvent) => {
                    console.log('ticket arrived for Offer!', e)
                    this._ticket = TicketEvent.from(e);
                    resolve(this.ticket);
                });

                sub.on("eose", () => {
                    resolve(null);
                });

                sub.start();
            } else {
                resolve(null);
            }
        });
    }
}
