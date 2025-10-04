import { NDKEvent, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';

export enum OnboardingJobStatus {
    New = 0,
    InProgress = 1,
    Resolved = 2,
    Failed = 3,
}

export class OnboardingJobEvent extends NDKEvent {
    private _status: OnboardingJobStatus;
    private _title: string;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= NDKKind.FreelanceJob;
        this._status = parseInt(this.tagValue('s') as string);
        this._title = this.tagValue('title') as string;
    }

    static from(event: NDKEvent) {
        return new OnboardingJobEvent(event.ndk, event.rawEvent());
    }

    get jobAddress(): string {
        return this.tagAddress();
    }

    // this.generateTags() will take care of setting d-tag

    get acceptedBidAddress(): string | undefined {
        return this.tagValue('a');
    }

    set acceptedBidAddress(bidAddress: string) {
        // Can only have exactly one accepted bid tag
        this.removeTag('a');
        this.tags.push(['a', bidAddress]);
        this.status = OnboardingJobStatus.InProgress;
    }

    get winnerFreelancer(): string | undefined {
        return this.acceptedBidAddress?.split(':')[1];
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

    get status(): OnboardingJobStatus {
        return this._status;
    }

    set status(status: OnboardingJobStatus) {
        this._status = status;
        this.removeTag('s');
        this.tags.push(['s', status.toString()]);
    }

    public isClosed(): boolean {
        return this._status === OnboardingJobStatus.Resolved || this._status === OnboardingJobStatus.Failed;
    }

    get description(): string {
        return this.content;
    }

    set description(desc: string) {
        this.content = desc;
    }

    get tTags(): NDKTag[] {
        return this.tags.filter((tag: NDKTag) => tag[0] === 't');
    }
}
