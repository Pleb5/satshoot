import { BTCTroubleshootKind } from "./kinds";
import { NDKEvent, type NDK, type NDKTag, type NostrEvent } from "@nostr-dev-kit/ndk";

export enum TicketStatus {
    New = 0,
    InProgress = 1,
    Closed = 2,
}


export class TicketEvent extends NDKEvent {

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= BTCTroubleshootKind.Ticket;
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

    get title(): string | undefined {
        return this.tagValue("title");
    }

    set title(title: string) {
        // Can only have exactly one title tag
        this.removeTag('title');
        this.tags.push(['title', title]);
    }

    get status(): TicketStatus | undefined {
        return parseInt(this.tagValue('status') as string);
    }

    set status(status: TicketStatus) {
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
        return this.tags.filter((tag:NDKTag) => tag[0] == 't');
    }

}
