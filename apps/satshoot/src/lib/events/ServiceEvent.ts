import { NDKEvent, type Hexpubkey, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { Pricing, type ZapSplit } from './types';
import { SatShootPubkey } from '$lib/utils/misc';
import { nip19 } from 'nostr-tools';
import { BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/session';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

export enum ServiceStatus {
    InActive,
    Active,
}

export class ServiceEvent extends NDKEvent {
    private _status: ServiceStatus;
    private _title: string;
    private _pricing: Pricing;
    private _amount: number;
    private _pledgeSplit: number = 0;
    private _sponsoringSplit: number = 0;
    private _sponsoredNpub: string = '';

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= ExtendedNDKKind.FreelanceService;
        this._status = parseInt(this.tagValue('s') as string);
        this._title = this.tagValue('title') as string;
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
        this.parseZapSplits();
    }

    static from(event: NDKEvent) {
        return new ServiceEvent(event.ndk, event.rawEvent());
    }

    // this.generateTags() will take care of setting d-tag

    get serviceAddress(): string {
        return this.tagAddress();
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

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }

    get tTags() {
        return this.tags.filter((tag) => tag[0] === 't');
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

    get status(): ServiceStatus {
        return this._status;
    }

    set status(status: ServiceStatus) {
        this._status = status;
        this.removeTag('s');
        this.tags.push(['s', status.toString()]);
    }

    get images(): string[] {
        return this.tags.filter((tag: NDKTag) => tag[0] === 'image').map((tag) => tag[1]);
    }

    set images(urls: string[]) {
        this.removeTag('image');

        urls.forEach((url) => {
            this.tags.push(['image', url]);
        });
    }

    // get zapSplits(): ZapSplit[] {
    //     return this.tags
    //         .filter((tag) => tag[0] === 'zap')
    //         .map((tag) => ({
    //             pubkey: tag[1],
    //             percentage: parseInt(tag[3] ?? '0'),
    //         }));
    // }

    get orders(): string[] {
        return this.tags.filter((tag: NDKTag) => tag[0] === 'a').map((tag) => tag[1]);
    }

    public addOrder(orderAddress: string) {
        this.tags.push(['a', orderAddress]);
    }

    // public addZapSplits(zapSplits: ZapSplit[]) {
    //     // Validate individual percentages
    //     for (const zapSplit of zapSplits) {
    //         if (zapSplit.percentage <= 0) {
    //             throw new Error(
    //                 `Invalid zap split: percentage must be > 0. Got ${zapSplit.percentage} for pubkey ${zapSplit.pubkey}`
    //             );
    //         }
    //     }
    //
    //     // Validate sum of percentages
    //     const totalPercentage = zapSplits.reduce((sum, z) => sum + z.percentage, 0);
    //     if (totalPercentage !== 100) {
    //         throw new Error(
    //             `Invalid zap splits: total percentage must equal 100. Got ${totalPercentage}`
    //         );
    //     }
    //
    //     // Remove existing zap tags and add new ones
    //     this.removeTag('zap');
    //     zapSplits.forEach((zapSplit) => {
    //         this.tags.push([
    //             'zap',
    //             zapSplit.pubkey,
    //             zapSplit.relayHint ?? '',
    //             zapSplit.percentage.toString(),
    //         ]);
    //     });
    // }
}
