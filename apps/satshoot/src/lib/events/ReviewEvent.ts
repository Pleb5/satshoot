import { ExtendedNDKKind } from '$lib/types/ndkKind';
import { NDKEvent, type NDKTag, type NostrEvent, type Hexpubkey } from '@nostr-dev-kit/ndk';

import NDK from '@nostr-dev-kit/ndk';

enum FreelancerRatings {
    success = 0.5,
    expertise = 0.3,
    communication = 0.2,
}

enum ClientRatings {
    thumb = 0.5,
    communication = 0.5,
}

export enum ReviewType {
    Freelancer = 'freelancer',
    Client = 'client',
}

export interface ClientRating {
    thumb: boolean;
    communication: boolean;
    reviewText: string;
}

export const THUMBS_UP_TEXT = 'Positive Experience';
export const THUMBS_DOWN_TEXT = 'Negative Experience';
export const COMMUNICATION_TEXT = 'Communication';

export const SUCCESS_TEXT = 'Successful Jobs';
export const FAILED_TEXT = 'Failed Jobs';
export const EXPERTISE_TEXT = 'Expertise';

export interface FreelancerRating {
    success: boolean;
    expertise: boolean;
    communication: boolean;
    reviewText: string;
}

// In the future perhaps make the two types of reviews extend a common ReviewEvent
// this way it would use two different event stores and use common ancestor functions
// and would not need lots of type checking. More elegant solution overall
export class ReviewEvent extends NDKEvent {
    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= ExtendedNDKKind.Review;
        if (!this.tagValue('L')) {
            this.tags.push(['L', 'qts/freelancing']);
        }
    }

    static from(event: NDKEvent) {
        return new ReviewEvent(event.ndk, event.rawEvent());
    }

    get type(): ReviewType | undefined {
        const typeString = this.tagValue('l');

        if (!typeString) return undefined;

        if (typeString === ReviewType.Client) {
            return ReviewType.Client;
        }
        return ReviewType.Freelancer;
    }

    set type(t: ReviewType) {
        this.removeTag('l');
        this.tags.push(['l', t, 'qts/freelancing']);
    }

    set clientRatings(r: ClientRating) {
        if (this.type === ReviewType.Freelancer) {
            throw new Error('Forbidden: Trying to set client rating of a Freelancer review event!');
        }
        this.removeTag('l');
        this.tags.push(['l', ReviewType.Client, 'qts/freelancing']);

        this.removeTag('rating');

        const thumb = r.thumb ? '1' : '0';
        this.tags.push(['rating', thumb, 'thumb']);

        const communication = r.communication ? '1' : '0';
        this.tags.push(['rating', communication, 'communication']);

        this.content = r.reviewText;
    }

    get clientRatings(): ClientRating {
        if (this.type !== ReviewType.Client) {
            throw new Error('Requested Client ratings but review type is NOT Client!');
        }
        const clientRating: ClientRating = {
            thumb: false,
            communication: false,
            reviewText: this.content,
        };
        this.tags.forEach((tag: NDKTag) => {
            const rating = parseFloat(tag[1]);
            if (isNaN(rating)) return;

            if (tag.includes('rating') && tag.includes('thumb') && rating > 0) {
                clientRating.thumb = true;
            } else if (tag.includes('rating') && tag.includes('communication') && rating > 0) {
                clientRating.communication = true;
            }
        });
        return clientRating;
    }

    set freelancerRatings(r: FreelancerRating) {
        if (this.type === ReviewType.Client) {
            throw new Error('Forbidden: Trying to set Freelancer rating of a Client review event!');
        }
        this.removeTag('l');
        this.tags.push(['l', ReviewType.Freelancer, 'qts/freelancing']);

        this.removeTag('rating');

        const success = r.success ? '1' : '0';
        this.tags.push(['rating', success, 'success']);

        const expertise = r.expertise ? '1' : '0';
        this.tags.push(['rating', expertise, 'expertise']);

        const communication = r.communication ? '1' : '0';
        this.tags.push(['rating', communication, 'communication']);

        this.content = r.reviewText;
    }

    get freelancerRatings(): FreelancerRating {
        if (this.type !== ReviewType.Freelancer) {
            throw new Error('Requested Freelancer ratings but review type is NOT Freelancer!');
        }
        const freelancerRating: FreelancerRating = {
            success: false,
            expertise: false,
            communication: false,
            reviewText: this.content,
        };
        this.tags.forEach((tag: NDKTag) => {
            const rating = parseFloat(tag[1]);
            if (isNaN(rating)) return;

            if (tag.includes('rating') && tag.includes('success') && rating > 0) {
                freelancerRating.success = true;
            } else if (tag.includes('rating') && tag.includes('expertise') && rating > 0) {
                freelancerRating.expertise = true;
            } else if (tag.includes('rating') && tag.includes('communication') && rating > 0) {
                freelancerRating.communication = true;
            }
        });
        return freelancerRating;
    }

    get reviewedEventAddress(): string | undefined {
        return this.tagValue('a');
    }

    set reviewedEventAddress(eventAddress: string) {
        const eventKind = parseInt(eventAddress.split(':')[0] as string);
        if (
            this.type === ReviewType.Client &&
            (eventKind === ExtendedNDKKind.FreelanceBid ||
                eventKind === ExtendedNDKKind.FreelanceService)
        ) {
            throw new Error('Client reviews can only be given on Job/Order events');
        }

        if (
            this.type === ReviewType.Freelancer &&
            (eventKind === ExtendedNDKKind.FreelanceJob ||
                eventKind === ExtendedNDKKind.FreelanceOrder)
        ) {
            throw new Error('Freelancer reviews can only be given on Bid/service events');
        }

        this.removeTag('a');
        this.tags.push(['a', eventAddress]);
    }

    // Handle undefined everywhere !!!
    get reviewedPerson(): Hexpubkey | undefined {
        const id = this.tagValue('a');

        if (!id) return undefined;

        return id.split(':')[1] as Hexpubkey;
    }

    get reviewedEventDtag(): string {
        const id = this.tagValue('a') as string;
        return id.split(':')[2] as string;
    }

    get overallRating(): number | undefined {
        let sum = 0;
        if (this.type === ReviewType.Client) {
            this.tags.forEach((tag: NDKTag) => {
                if (tag.includes('rating')) {
                    const rating = parseFloat(tag[1]);
                    // if rating is not a number or it's 0, just simply return
                    if (isNaN(rating) || !rating) return;

                    if (tag.includes('thumb')) {
                        sum += ClientRatings.thumb;
                    } else if (tag.includes('communication')) {
                        sum += ClientRatings.communication;
                    }
                }
            });
            return sum;
        } else if (this.type === ReviewType.Freelancer) {
            this.tags.forEach((tag: NDKTag) => {
                if (tag.includes('rating')) {
                    const rating = parseFloat(tag[1]);
                    // if rating is not a number or it's 0, just simply return
                    if (isNaN(rating) || !rating) return;

                    if (tag.includes('success')) {
                        sum += FreelancerRatings.success;
                    } else if (tag.includes('expertise')) {
                        sum += FreelancerRatings.expertise;
                    } else if (tag.includes('communication')) {
                        sum += FreelancerRatings.communication;
                    }
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
