import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';

export enum OrderStatus {
    InActive,
    Active,
}

export class OrderEvent extends NDKEvent {
    private _status: OrderStatus;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.FreelanceOrder;
        this._status = parseInt(this.tagValue('s') as string);
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
}
