import { BTCTroubleshootKind } from "./kinds";
import { NDKEvent, type NDKTag, type NostrEvent } from "@nostr-dev-kit/ndk";

export enum TicketStatus {
    New = 0,
    InProgress = 1,
    Closed = 2,
}


export class TicketEvent extends NDKEvent {
    private _status: TicketStatus;
    private _title: string;
    private _tTags: NDKTag[];

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= BTCTroubleshootKind.Ticket;
        this._status = parseInt(this.tagValue('status') as string);
        this._title = this.tagValue('title') as string;
        this._tTags = this.tags.filter((tag:NDKTag) => tag[0]==='t');
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
        this._status = TicketStatus.InProgress;
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

}
