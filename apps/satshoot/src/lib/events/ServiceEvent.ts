import { NDKEvent, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';
import { Pricing, type ZapSplit } from './types';

export enum ServiceStatus {
    InActive,
    Active,
}

export class ServiceEvent extends NDKEvent {
    private _status: ServiceStatus;
    private _title: string;
    private _pricing: Pricing;
    private _amount: number;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.FreelanceService;
        this._status = parseInt(this.tagValue('s') as string);
        this._title = this.tagValue('title') as string;
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
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
        return this.tags.filter((tag) => tag[0] === 'a').map((tag) => {});
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

    get acceptedOrders(): string[] {
        return this.tags.filter((tag: NDKTag) => tag[0] === 'a').map((tag) => tag[1]);
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
