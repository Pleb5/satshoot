import { NDKEvent, type Hexpubkey, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';
import { Pricing, type ZapSplit } from './types';
import { SatShootPubkey } from '$lib/utils/misc';
import { nip19 } from 'nostr-tools';
import { BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/session';

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
        this.kind ??= NDKKind.FreelanceService;
        this._status = parseInt(this.tagValue('s') as string);
        this._title = this.tagValue('title') as string;
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
        let satshootPercentage = 0;
        let sponsoredPercentage = 0;
        this.tags.forEach((tag: NDKTag) => {
            if (tag[0] === 'zap') {
                if (tag[1] === SatShootPubkey) {
                    satshootPercentage = parseInt(tag[3] ?? '0');
                    // Enforce range
                    if (satshootPercentage < 0 || satshootPercentage > 100) {
                        satshootPercentage = 0;
                    }
                } else if (tag[1] !== this.pubkey) {
                    //console.log('Sponsored pubkey: ', tag[1]);
                    //console.log('this.pubkey: ', this.pubkey);
                    this._sponsoredNpub = nip19.npubEncode(tag[1]);
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
        this._sponsoringSplit = this._pledgeSplit ? Math.floor(sponsoredPercentage / this._pledgeSplit * 100) : 0;
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
                throw new Error(`Trying to set invalid zap split percentage for sponsored npub: ${sponsoredZapSplit.percentage} !`);
            }
            try {
                this._sponsoredNpub = nip19.npubEncode(sponsoredZapSplit.pubkey);
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
        if (sponsoredZapSplit && sponsoredPercentage) {
            this._sponsoringSplit = sponsoredZapSplit.percentage;
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

    get zapSplits(): ZapSplit[] {
        return this.tags
            .filter((tag) => tag[0] === 'zap')
            .map((tag) => ({
                pubkey: tag[1],
                percentage: parseInt(tag[3] ?? '0'),
            }));
    }

    get orders(): string[] {
        return this.tags.filter((tag: NDKTag) => tag[0] === 'a').map((tag) => tag[1]);
    }

    public addOrder(orderAddress: string) {
        this.tags.push(['a', orderAddress]);
    }

    public addZapSplits(zapSplits: ZapSplit[]) {
        // Validate individual percentages
        for (const zapSplit of zapSplits) {
            if (zapSplit.percentage <= 0) {
                throw new Error(
                    `Invalid zap split: percentage must be > 0. Got ${zapSplit.percentage} for pubkey ${zapSplit.pubkey}`
                );
            }
        }

        // Validate sum of percentages
        const totalPercentage = zapSplits.reduce((sum, z) => sum + z.percentage, 0);
        if (totalPercentage !== 100) {
            throw new Error(
                `Invalid zap splits: total percentage must equal 100. Got ${totalPercentage}`
            );
        }

        // Remove existing zap tags and add new ones
        this.removeTag('zap');
        zapSplits.forEach((zapSplit) => {
            this.tags.push([
                'zap',
                zapSplit.pubkey,
                zapSplit.relayHint ?? '',
                zapSplit.percentage.toString(),
            ]);
        });
    }
}
