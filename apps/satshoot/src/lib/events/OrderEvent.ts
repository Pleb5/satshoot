import { NDKEvent, type Hexpubkey, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';
import { Pricing } from './types';
import { SatShootPubkey } from '$lib/utils/misc';
import { nip19 } from 'nostr-tools';
import { BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/session';

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

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.FreelanceOrder;
        this._status = parseInt(this.tagValue('s') as string);
        this._pricing = parseInt(this.tagValue('pricing') ?? Pricing.Absolute.toString());
        this._amount = parseInt(this.tagValue('amount') ?? '0');
        this.tags.forEach((tag: NDKTag) => {
            if (tag[0] === 'zap') {
                // console.log('bid zap tag:', tag)
                if (tag[1] === SatShootPubkey) {
                    this._pledgeSplit = parseInt(tag[3] ?? '0');
                    // console.log('bid pledge split:', this._pledgeSplit)
                    // Enforce range
                    if (this._pledgeSplit < 0 || this._pledgeSplit > 100) {
                        this._pledgeSplit = 0;
                    }
                }
            }
        });
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
}
