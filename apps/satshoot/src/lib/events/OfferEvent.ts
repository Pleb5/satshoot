import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, type Hexpubkey, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import { SatShootPubkey } from '$lib/utils/misc';

import { BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/session';

import { nip19 } from 'nostr-tools';
import { NDKKind } from '@nostr-dev-kit/ndk';

// Offer Status is implicitly set by the JobEvent referenced by this offer's 'a' tag.
// When job updates its 'a' tag, ALL offers statuses change that referenced this job
export enum OfferStatus {
    Pending = 0, // No 'a' tag present in JobEvent
    Won = 1, // JobEvent references this event in its 'a' tag
    Lost = 2, // JobEvent references a different OfferEvent
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
    // number between [0 : 100] inclusively
    private _pledgeSplit: number = 0;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.FreelanceOffer;
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
        this.tags.forEach((tag: NDKTag) => {
            if (tag[0] === 'zap') {
                // console.log('offer zap tag:', tag)
                if (tag[1] === SatShootPubkey) {
                    this._pledgeSplit = parseInt(tag[3] ?? '0');
                    // console.log('offer pledge split:', this._pledgeSplit)
                    // Enforce range
                    if (this._pledgeSplit < 0 || this._pledgeSplit > 100) {
                        this._pledgeSplit = 0;
                    }
                }
            }
        });
    }

    static from(event: NDKEvent) {
        return new OfferEvent(event.ndk, event.rawEvent());
    }

    get offerAddress(): string {
        return this.tagAddress();
    }

    // this.generateTags() will take care of setting d-tag

    get referencedJobAddress(): string {
        return this.tagValue('a') as string;
    }

    set referencedJobAddress(referencedJobAddress: string) {
        // Can only have exactly one accepted offer tag
        this.removeTag('a');
        this.tags.push(['a', referencedJobAddress]);
    }

    get referencedJobDTag(): string | undefined {
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

    get pledgeSplit(): number {
        return this._pledgeSplit;
    }

    // Freelancer equals this.pubkey but it is not assured
    // that this.pubkey is defined at this point. So a simple setter wont suffice
    public setPledgeSplit(pledgeSplit: number, freelancer: Hexpubkey) {
        if (pledgeSplit < 0 || pledgeSplit > 100) {
            throw new Error(`Trying to set invalid zap split percentage: ${pledgeSplit} !`);
        }
        try {
            nip19.npubEncode(freelancer);
        } catch {
            throw new Error(`Invalid Freelancer pubkey: ${freelancer}, cannot set zap splits!`);
        }
        this.removeTag('zap');
        this.tags.push(['zap', SatShootPubkey, BOOTSTRAPOUTBOXRELAYS[0], pledgeSplit.toString()]);
        this.tags.push([
            'zap',
            freelancer,
            BOOTSTRAPOUTBOXRELAYS[0],
            (100 - pledgeSplit).toString(),
        ]);
        this._pledgeSplit = pledgeSplit;
    }

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }
}
