import { NDKEvent, type Hexpubkey, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { Pricing, type ZapSplit } from './types';
import { SatShootPubkey } from '$lib/utils/misc';
import { nip19 } from 'nostr-tools';
import { BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/session';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

export enum OrderStatus {
    Open,
    Fulfilled,
    Failed,
}

export class OrderEvent extends NDKEvent {
    private _status: OrderStatus;
    private _pricing: Pricing;
    private _amount: number;
    // number between [0 : 100] inclusively
    private _pledgeSplit: number = 0;
    // we save the sponsoring info as well, at the time of Order
    // BUT payments should be based on current values on the Service!!!
    private _sponsoringSplit: number = 0;
    private _sponsoredNpub: string = '';

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= ExtendedNDKKind.FreelanceOrder;
        this._status = parseInt(this.tagValue('s') as string);
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
        this.parseZapSplits();

        if (this.created_at && !this.publishedAt) {
            this.publishedAt = this.created_at;
        }
    }

    static from(event: NDKEvent) {
        return new OrderEvent(event.ndk, event.rawEvent());
    }

    // this.generateTags() will take care of setting d-tag

    get orderAddress(): string {
        return this.tagAddress();
    }

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }

    get status(): OrderStatus {
        return this._status;
    }

    set status(status: OrderStatus) {
        this._status = status;
        this.removeTag('s');
        this.tags.push(['s', status.toString()]);
    }

    get referencedServiceAddress(): string {
        return this.tagValue('a') as string;
    }

    set referencedServiceAddress(referencedServiceAddress: string) {
        // Can only have exactly one accepted bid tag
        this.removeTag('a');
        this.tags.push(['a', referencedServiceAddress]);
    }

    get referencedServiceDTag(): string | undefined {
        const aTag = this.tagValue('a');
        if (!aTag) return undefined;

        return aTag.split(':')[2];
    }

    get referencedServiceProvider(): string | undefined {
        const aTag = this.tagValue('a');
        if (!aTag) return undefined;

        return aTag.split(':')[1];
    }

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

    get sponsoringSplit(): number {
        return this._sponsoringSplit;
    }

    get sponsoredNpub(): string {
        return this._sponsoredNpub;
    }

    get publishedAt(): number {
        return parseInt(this.tagValue('published_at') ?? '0');
    }

    set publishedAt(publishedAt: number) {
        this.removeTag('published_at');
        this.tags.push(['published_at', publishedAt.toString()]);
    }

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

    /**
     * Adds a state history entry when status changes
     * @param oldStatus Previous order status
     */
    addStateHistory(oldStatus: OrderStatus) {
        const timestamp = Math.floor(Date.now() / 1000);

        this.tags.push([
            'state_history',
            oldStatus.toString(),
            this._status.toString(),
            timestamp.toString(),
        ]);
    }

    /**
     * Gets the state history from tags
     */
    get stateHistory(): Array<{
        fromStatus: OrderStatus;
        toStatus: OrderStatus;
        timestamp: number;
    }> {
        return this.tags
            .filter((tag: NDKTag) => tag[0] === 'state_history')
            .map((tag: NDKTag) => ({
                fromStatus: parseInt(tag[1]) as OrderStatus,
                toStatus: parseInt(tag[2]) as OrderStatus,
                timestamp: parseInt(tag[3]),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }
}
