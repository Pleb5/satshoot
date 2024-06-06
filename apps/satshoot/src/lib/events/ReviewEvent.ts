import { 
    NDKEvent,
    type NDKTag,
    type NostrEvent,
    NDKKind, 
    type Hexpubkey 
} from "@nostr-dev-kit/ndk";

import NDK from "@nostr-dev-kit/ndk"

import { BTCTroubleshootKind } from "./kinds";

enum TroubleshooterRatings {
    success = '0.5',
    expertise = '0.2',
    availability = '0.15',
    communication = '0.15',
}

enum ClientRatings {
    thumb = '0.5',
    availability = '0.25',
    communication = '0.25',
}

export enum ReviewType {
    Troubleshooter = 'troubleshooter',
    Client = 'client',
}

export interface ClientRating {
    thumb: boolean;
    availability: boolean;
    communication: boolean;
    reviewText: string;
}

export interface TroubleshooterRating {
    success: boolean;
    expertise: boolean;
    availability: boolean;
    communication: boolean;
    reviewText: string;
}

// In the future perhaps make the two types of reviews extend a common ReviewEvent
// this way it would use two different event stores and use common ancestor functions
// and would not need lots of type checking. More elegant solution overall
export class ReviewEvent extends NDKEvent {
    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.Review;
        if (!this.tagValue('L')) {
            this.tags.push(["L", 'qts/troubleshooting']);
        }
    }

    static from(event:NDKEvent){
        return new ReviewEvent(event.ndk, event.rawEvent());
    }

    get type(): ReviewType | undefined {
        const typeString = this.tagValue('l');

        if (!typeString) return undefined;

        if (typeString === ReviewType.Client) {
            return ReviewType.Client;
        } 
        return ReviewType.Troubleshooter;
    }

    set type(t: ReviewType) {
        this.removeTag('l');
        this.tags.push(['l', t, 'qts/troubleshooting']);
    }

    set clientRatings(r: ClientRating) {
        if (this.type === ReviewType.Troubleshooter) {
            throw new Error('Forbidden: Trying to set client rating of a Troubleshooter review event!');
        }
        this.removeTag('l');
        this.tags.push(['l', ReviewType.Client, 'qts/troubleshooting']);

        this.removeTag('rating');

        const thumb = r.thumb ? ClientRatings.thumb : '0';
        this.tags.push(['rating', thumb, 'thumb']);

        const availability = r.availability ? ClientRatings.availability : '0';
        this.tags.push(['rating', availability, 'availability']);

        const communication = r.communication ? ClientRatings.communication : '0';
        this.tags.push(['rating', communication, 'communication']);

        this.content = r.reviewText;
    }

    set troubleshooterRatings(r: TroubleshooterRating) {
        if (this.type === ReviewType.Client) {
            throw new Error('Forbidden: Trying to set troubleshooter rating of a Client review event!');
        }
        this.removeTag('l');
        this.tags.push(['l', ReviewType.Troubleshooter, 'qts/troubleshooting']);

        this.removeTag('rating');

        const success = r.success ? TroubleshooterRatings.success : '0';
        this.tags.push(['rating', success, 'success']);

        const expertise = r.expertise ? TroubleshooterRatings.expertise : '0';
        this.tags.push(['rating', expertise, 'expertise']);

        const availability = r.availability ? TroubleshooterRatings.availability : '0';
        this.tags.push(['rating', availability, 'availability']);

        const communication = r.communication ? TroubleshooterRatings.communication : '0';
        this.tags.push(['rating', communication, 'communication']);

        this.content = r.reviewText;
    }

    get ratings(): ClientRating | TroubleshooterRating | undefined{
        if (this.type === ReviewType.Client) {
            const clientRating: ClientRating = {
                thumb: false,
                availability: false,
                communication: false,
                reviewText: this.content,
            }
            this.tags.forEach((tag: NDKTag) => {
                const rating = parseFloat(tag[1]);
                if (isNaN(rating)) return;

                if (tag.includes('rating')
                    && tag.includes('thumb') && rating > 0) {
                    clientRating.thumb = true;
                } else if (tag.includes('rating')
                    && tag.includes('availability') && rating > 0) {
                    clientRating.availability = true;
                } else if (tag.includes('rating')
                    && tag.includes('communication') && rating > 0) {
                    clientRating.communication = true;
                }
            });
            return clientRating;
        } else if (this.type === ReviewType.Troubleshooter) {
            const troubleshooterRating: TroubleshooterRating = {
                success: false,
                expertise: false,
                availability: false,
                communication: false,
                reviewText: this.content,
            }
            this.tags.forEach((tag: NDKTag) => {
                const rating = parseFloat(tag[1]);
                if (isNaN(rating)) return;

                if (tag.includes('rating')
                    && tag.includes('success') && rating > 0) {
                    troubleshooterRating.success = true;
                } else if (tag.includes('rating')
                    && tag.includes('expertise') && rating > 0) {
                    troubleshooterRating.expertise = true;
                } else if (tag.includes('rating')
                    && tag.includes('availability') && rating > 0) {
                    troubleshooterRating.availability = true;
                } else if (tag.includes('rating')
                    && tag.includes('communication') && rating > 0) {
                    troubleshooterRating.communication = true;
                }
            });
            return troubleshooterRating;
        }

        return undefined;
    }

    get reviewedEventId(): string | undefined{
        return this.tagValue("a");
    }

    set reviewedEventId(eventID: string) {
        const eventKind = parseInt(eventID.split(':')[0] as string);
        if (eventKind === BTCTroubleshootKind.Offer && this.type === ReviewType.Client) {
            throw new Error('Client reviews can only be given on Ticket events');
        }

        if (eventKind === BTCTroubleshootKind.Ticket && this.type === ReviewType.Troubleshooter) {
            throw new Error('Troubleshooter reviews can only be given on Offer events');
        }

        this.removeTag('a');
        this.tags.push(['a', eventID]);
    }

    get reviewedEventKind(): BTCTroubleshootKind | number {
        const aTag = this.tagValue('a');
        if (!aTag) return this.kind;
        if ( ((aTag as string).split(':')[0] as number)
            === BTCTroubleshootKind.Ticket ) {
            return BTCTroubleshootKind.Ticket;
        } else return BTCTroubleshootKind.Offer;
    }

    // Handle udnefined everywhere !!!
    get reviewedPerson(): Hexpubkey | undefined{
        const id = this.tagValue('a');

        if (!id) return undefined;

        return id.split(':')[1] as Hexpubkey;
    }

    get reviewedEventDtag(): string {
        const id = this.tagValue('a') as string;
        return id.split(':')[2] as string;
    }

    get overallRating(): number | undefined{
        let sum = 0;
        if (this.type === ReviewType.Client) {
            this.tags.forEach((tag: NDKTag) => {
                if (tag.includes('rating') && tag.includes('thumb')) {
                    const value = tag[1];
                    if (value) sum += parseFloat(value as string);
                } else if (tag.includes('rating') && tag.includes('availability')) {
                    const value = tag[1];
                    if (value) sum += parseFloat(value as string);
                } else if (tag.includes('rating') && tag.includes('communication')) {
                    const value = tag[1];
                    if (value) sum += parseFloat(value as string);
                }
            });
            return sum;
        } else if (this.type === ReviewType.Troubleshooter) {
            this.tags.forEach((tag: NDKTag) => {
                if (tag.includes('rating') && tag.includes('success')) {
                    const value = tag[1];
                    if (value) sum += parseFloat(value as string);
                } else if (tag.includes('rating') && tag.includes('expertise')) {
                    const value = tag[1];
                    if (value) sum += parseFloat(value as string);
                } else if (tag.includes('rating') && tag.includes('availability')) {
                    const value = tag[1];
                    if (value) sum += parseFloat(value as string);
                } else if (tag.includes('rating') && tag.includes('communication')) {
                    const value = tag[1];
                    if (value) sum += parseFloat(value as string);
                }
            });
            return sum;
        }
        return undefined;
    }
    
    get reviewText(): string {
        return this.content;
    }
}
