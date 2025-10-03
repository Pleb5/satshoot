import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, type Hexpubkey, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import { SatShootPubkey } from '$lib/utils/misc';

import { BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/session';

import { nip19 } from 'nostr-tools';
import { Pricing, type ZapSplit } from './types';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

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
    private _sponsoringSplit: number = 0;
    private _sponsoredNpub: string = '';

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= ExtendedNDKKind.FreelanceBid;
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
        this.parseZapSplits();
        if (this.created_at && !this.publishedAt) {
            this.publishedAt = this.created_at;
        }
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
            throw new Error(`Trying to set invalid zap split percentage: ${pledgeSplit} !`);
        }
        if (sponsoredZapSplit) {
            if (sponsoredZapSplit.percentage < 0 || sponsoredZapSplit.percentage > 100) {
                throw new Error(
                    `Trying to set invalid zap split percentage for sponsored npub: ${sponsoredZapSplit.percentage} !`
                );
            }
            try {
                this._sponsoredNpub = nip19.npubEncode(sponsoredZapSplit.pubkey);
            } catch {
                throw new Error(
                    `Invalid sponsored pubkey: ${sponsoredZapSplit.pubkey}, cannot set zap splits!`
                );
            }
        }
        try {
            nip19.npubEncode(freelancer);
        } catch {
            throw new Error(`Invalid Freelancer pubkey: ${freelancer}, cannot set zap splits!`);
        }
        this.removeTag('zap');

        let sponsoredPercentage = 0;
        // We convert percentage to parts per 10_000 which is the lowest possible share
        let scaleFactor = 100;
        if (sponsoredZapSplit) {
            sponsoredPercentage = (pledgeSplit * sponsoredZapSplit.percentage) / 100;
        }

        const scaledSponsoredShare = Math.floor(sponsoredPercentage * scaleFactor);

        const scaledPledgeSplit = pledgeSplit * scaleFactor;

        const scaledSatshootShare = scaledPledgeSplit - scaledSponsoredShare;
        this.tags.push([
            'zap',
            SatShootPubkey,
            BOOTSTRAPOUTBOXRELAYS[0],
            scaledSatshootShare.toString(),
        ]);
        if (sponsoredZapSplit && sponsoredPercentage) {
            this._sponsoringSplit = sponsoredZapSplit.percentage;
            this.tags.push([
                'zap',
                sponsoredZapSplit.pubkey,
                BOOTSTRAPOUTBOXRELAYS[0],
                scaledSponsoredShare.toString(),
            ]);
        }
        this.tags.push([
            'zap',
            freelancer,
            BOOTSTRAPOUTBOXRELAYS[0],
            (10_000 - scaledPledgeSplit).toString(),
        ]);
        this._pledgeSplit = pledgeSplit;
    }

    private parseZapSplits() {
        // Parts per 10_000
        let satshootShare = 0;
        let sponsoredShare = 0;
        this.tags.forEach((tag: NDKTag) => {
            if (tag[0] === 'zap') {
                if (tag[1] === SatShootPubkey) {
                    satshootShare = parseInt(tag[3] ?? '0');
                    // Enforce range
                    if (satshootShare < 0 || satshootShare > 10_000) {
                        satshootShare = 0;
                    }
                } else if (tag[1] !== this.pubkey) {
                    this._sponsoredNpub = nip19.npubEncode(tag[1]);
                    sponsoredShare = parseInt(tag[3] ?? '0');
                    if (sponsoredShare < 0 || sponsoredShare > 10_000) {
                        sponsoredShare = 0;
                    }
                }
            }
        });

        // Migrate existing percentages
        if (satshootShare + sponsoredShare < 100) {
            satshootShare *= 100;
            sponsoredShare *= 100;
        }
        // Convert back to percentage
        this._pledgeSplit = Math.round((satshootShare + sponsoredShare) / 100);
        if (this._pledgeSplit < 0 || this._pledgeSplit > 100) {
            this._pledgeSplit = 0;
        }
        this._sponsoringSplit = this._pledgeSplit
            ? Math.round((sponsoredShare / (satshootShare + sponsoredShare)) * 100)
            : 0;
    }

    get sponsoringSplit(): number {
        return this._sponsoringSplit;
    }

    get sponsoredNpub(): string {
        return this._sponsoredNpub;
    }

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }

    get publishedAt(): number {
        return parseInt(this.tagValue('published_at') ?? '0');
    }

    set publishedAt(publishedAt: number) {
        this.removeTag('published_at');
        this.tags.push(['published_at', publishedAt.toString()]);
    }

    /**
     * Adds a pricing history entry when pricing or amount changes
     * @param oldPricing Previous pricing method
     * @param oldAmount Previous amount value
     */
    addPricingHistory(oldPricing: Pricing, oldAmount: number) {
        const oldData = { pricing: oldPricing, amount: oldAmount };
        const newData = { pricing: this._pricing, amount: this._amount };
        const timestamp = Math.floor(Date.now() / 1000);

        this.tags.push([
            'pricing_history',
            JSON.stringify(oldData),
            JSON.stringify(newData),
            timestamp.toString(),
        ]);
    }
}
