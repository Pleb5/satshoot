import { 
    NDKEvent,
    type NDKTag,
    type NostrEvent,
    NDKKind, 
    type Hexpubkey 
} from "@nostr-dev-kit/ndk";

import NDK from "@nostr-dev-kit/ndk"

import { BTCTroubleshootKind } from "./kinds";

export enum ReviewType {
    Troubleshooter = 'troubleshooter',
    Client = 'client',
}

export interface ClientRating {
    thumb: boolean;
    availability: boolean;
    communication: boolean;
}

export interface TroubleshooterRating {
    success: boolean;
    expertise: boolean;
    availability: boolean;
    communication: boolean;
}

export class ReviewEvent extends NDKEvent {
    private _type: ReviewType;
    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.Review;
        if (!this.tagValue('L')) {
            this.tags.push(["L", 'qts/troubleshooting']);
        }

        const typeString = this.tagValue('l');
        if (typeString === ReviewType.Client) {
            this.type = ReviewType.Client;
        } else {
            this.type = ReviewType.Troubleshooter;
        }
    }

    static from(event:NDKEvent){
        return new ReviewEvent(event.ndk, event.rawEvent());
    }

    get type(): ReviewType {
        return this._type;
    }

    set type(t: ReviewType) {
        this._type = t;
        this.removeTag('l');
        this.tags.push(['l', t, 'qts/troubleshooting']);
    }

    get ratings(): Map<string, number> {
        return this._rating
    }

    get reviewedEventId(): string {
        return this.tagValue("a");
    }

    set reviewedEventId(eventID: string) {
        this.removeTag('a');
        this.tags.push(['a', eventID]);
    }

    get reviewedEventKind(): BTCTroubleshootKind {
        if ( ((this.tagValue('a') as string).split(':')[0] as number)
            === BTCTroubleshootKind.Ticket ) {
            return BTCTroubleshootKind.Ticket;
        } else return BTCTroubleshootKind.Offer;
    }

    get reviewedPerson(): Hexpubkey {
        const id = this.tagValue('a') as string;
        return id.split(':')[1] as Hexpubkey;
    }

    get reviewedEventDtag(): string {
        const id = this.tagValue('a') as string;
        return id.split(':')[2] as string;
    }

    get overallRating(): number {
        let sum = 0;
        this._ratingforEach((value: number) => {
            sum += value;
        });

        return sum;
    }
    
    get reviewText(): string {
        return this.content;
    }

    set reviewText(text: string) {
        this.content = text;
    }
}
