import { BTCTroubleshootKind } from "./kinds";
import { NDKEvent, type NDKTag, type NostrEvent } from "@nostr-dev-kit/ndk";
import { NDKRelaySet } from "@nostr-dev-kit/ndk";
import { OfferEvent } from "./OfferEvent";
import type { NDKEventStore, ExtendedBaseType, NDKSvelte } from '@nostr-dev-kit/ndk-svelte';
import type { NDKFilter, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';

export enum TicketStatus {
    New = 0,
    InProgress = 1,
    Closed = 2,
}


export class TicketEvent extends NDKEvent {
    private _status: TicketStatus;
    private _title: string;
    private _tTags: NDKTag[];
    private _offersOnTicket: NDKEventStore<ExtendedBaseType<OfferEvent>> | null;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= BTCTroubleshootKind.Ticket;
        this._status = parseInt(this.tagValue('status') as string);
        this._title = this.tagValue('title') as string;
        this._tTags = this.tags.filter((tag:NDKTag) => tag[0]==='t');
        this._offersOnTicket = null;
    }

    static from(event:NDKEvent){
        return new TicketEvent(event.ndk, event.rawEvent());
    }

    get ticketAddress(): string {
        return this.tagAddress();
    }

    // this.generateTags() will take care of setting d-tag

    get acceptedOfferAddress(): string | undefined {
        return this.tagValue("a");
    }

    set acceptedOfferAddress(offerAddress: string) {
        // Can only have exactly one accepted offer tag
        this.removeTag('a');
        this.tags.push(['a', offerAddress]);
    }

    get title(): string {
        return this._title;
    }

    set title(title: string) {
        this._title = title;
        // Can only have exactly one title tag
        this.removeTag('title');
        this.tags.push(['title', title]);
    }

    get status(): TicketStatus {
        return this._status;
    }

    set status(status: TicketStatus) {
        this._status = status;
        this.removeTag('status');
        this.tags.push(['status', status.toString()]);
    }
    
    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }

    get tTags(): NDKTag[] {
        return this._tTags;
    }

    set tTags(tags: NDKTag[]) {
        this._tTags = tags;
    }

    get offersOnTicket(): NDKEventStore<ExtendedBaseType<OfferEvent>> | null {
        return this._offersOnTicket;
    }

    set offersOnTicket(offers: NDKEventStore<ExtendedBaseType<OfferEvent>> | null) {
        this._offersOnTicket = offers;
    }

    public setupOfferSubs() {
        if (this.ndk && !this._offersOnTicket) {
            const offerFilter: NDKFilter<BTCTroubleshootKind> = {
                kinds: [BTCTroubleshootKind.Offer],
                '#a': [this.ticketAddress],
                limit:500
            };

            const subOptions: NDKSubscriptionOptions = {
                closeOnEose: false,
                pool: this.ndk.pool
            };
            this._offersOnTicket = (this.ndk as NDKSvelte).storeSubscribe(offerFilter, subOptions, OfferEvent);
        }
    }


}
