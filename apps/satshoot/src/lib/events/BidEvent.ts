import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, type Hexpubkey, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import { SatShootPubkey } from '$lib/utils/misc';

import { BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/session';

import { nip19 } from 'nostr-tools';
import { NDKKind } from '@nostr-dev-kit/ndk';
import { Pricing, type ZapSplit } from './types';

// Bid Status is implicitly set by the JobEvent referenced by this bid's 'a' tag.
// When job updates its 'a' tag, ALL bids statuses change that referenced this job
export enum BidStatus {
    Pending = 0, // No 'a' tag present in JobEvent
    Won = 1, // JobEvent references this event in its 'a' tag
    Lost = 2, // JobEvent references a different BidEvent
}

export class BidEvent extends NDKEvent {
    private _pricing: Pricing;
    private _amount: number;
    // number between [0 : 100] inclusively
    private _pledgeSplit: number = 0;
    private _sponsoredSplit: number = 0;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.FreelanceBid;
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
        let satshootPercentage = 0;
        let sponsoredPercentage = 0;
        this.tags.forEach((tag: NDKTag) => {
            if (tag[0] === 'zap') {
                // console.log('bid zap tag:', tag)
                if (tag[1] === SatShootPubkey) {
                    satshootPercentage = parseInt(tag[3] ?? '0');
                    // console.log('bid pledge split:', this._pledgeSplit)
                    // Enforce range
                    if (satshootPercentage < 0 || satshootPercentage > 100) {
                        satshootPercentage = 0;
                    }
                } else if (tag[1] !== this.pubkey) {
                    sponsoredPercentage = parseInt(tag[3] ?? '0');
                    if (sponsoredPercentage < 0 || sponsoredPercentage > 100) {
                        sponsoredPercentage = 0;
                    }
                }
            }
        });
        this._pledgeSplit = satshootPercentage + sponsoredPercentage;
        if (this._pledgeSplit < 0 || this._pledgeSplit > 100) {
            this._pledgeSplit = 0;
        }
        this._sponsoredSplit = this._pledgeSplit ? Math.floor(sponsoredPercentage / this._pledgeSplit * 100) : 0;
    }

    static from(event: NDKEvent) {
        return new BidEvent(event.ndk, event.rawEvent());
    }

    get bidAddress(): string {
        return this.tagAddress();
    }

    // this.generateTags() will take care of setting d-tag

    get referencedJobAddress(): string {
        return this.tagValue('a') as string;
    }

    set referencedJobAddress(referencedJobAddress: string) {
        // Can only have exactly one accepted bid tag
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
    public setZapSplits(pledgeSplit: number, freelancer: Hexpubkey, sponsoredZapSplit?: ZapSplit) {
        if (pledgeSplit < 0 || pledgeSplit > 100) {
            throw new Error(`Trying to set invalid pledge zap split percentage: ${pledgeSplit} !`);
        }
        if (sponsoredZapSplit) {
            if (sponsoredZapSplit.percentage < 0 || sponsoredZapSplit.percentage > 100) {
                throw new Error(`Trying to set invalid zap split percentage for sponsored npub: ${sponsoredZapSplit.percentage} !`);
            }
            try {
                nip19.npubEncode(sponsoredZapSplit.pubkey);
            } catch {
                throw new Error(`Invalid sponsored pubkey: ${sponsoredZapSplit.pubkey}, cannot set zap splits!`);
            }
        }
        try {
            nip19.npubEncode(freelancer);
        } catch {
            throw new Error(`Invalid Freelancer pubkey: ${freelancer}, cannot set zap splits!`);
        }

        this.removeTag('zap');
        const sponsoredPercentage = sponsoredZapSplit ? Math.floor(pledgeSplit * sponsoredZapSplit.percentage / 100) : 0;
        const satshootPercentage = pledgeSplit - sponsoredPercentage;
        this.tags.push(['zap', SatShootPubkey, BOOTSTRAPOUTBOXRELAYS[0], satshootPercentage.toString()]);
        if (sponsoredZapSplit) {
            this.tags.push(['zap', sponsoredZapSplit.pubkey, BOOTSTRAPOUTBOXRELAYS[0], sponsoredPercentage.toString()]);
        }
        this.tags.push([
            'zap',
            freelancer,
            BOOTSTRAPOUTBOXRELAYS[0],
            (100 - pledgeSplit).toString(),
        ]);
        this._pledgeSplit = pledgeSplit;
    }

    get sponsoredSplit(): number {
        return this._sponsoredSplit;
    }

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }
}
