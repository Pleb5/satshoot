import { ExtendedNDKKind } from '$lib/types/ndkKind';
import { NDKEvent, type NDKTag, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';

export enum JobStatus {
    New = 0,
    InProgress = 1,
    Resolved = 2,
    Failed = 3,
}

export class JobEvent extends NDKEvent {
    private _status: JobStatus;
    private _title: string;

    constructor(ndk?: NDK, rawEvent?: NostrEvent) {
        super(ndk, rawEvent);
        this.kind ??= ExtendedNDKKind.FreelanceJob;
        this._status = parseInt(this.tagValue('s') as string);
        this._title = this.tagValue('title') as string;

        if (this.created_at && !this.publishedAt) {
            this.publishedAt = this.created_at;
        }
    }

    static from(event: NDKEvent) {
        return new JobEvent(event.ndk, event.rawEvent());
    }

    get jobAddress(): string {
        return this.tagAddress();
    }

    // this.generateTags() will take care of setting d-tag

    get acceptedBidAddress(): string | undefined {
        return this.tagValue('a');
    }

    set acceptedBidAddress(bidAddress: string) {
        const timestamp = Math.floor(Date.now() / 1000);

        // Can only have exactly one accepted bid tag
        this.removeTag('a');
        this.tags.push(['a', bidAddress, timestamp.toString()]);
        this.status = JobStatus.InProgress;

        this.addStateHistory(JobStatus.InProgress, timestamp);
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

    get status(): JobStatus {
        return this._status;
    }

    set status(status: JobStatus) {
        this._status = status;
        this.removeTag('s');
        this.tags.push(['s', status.toString()]);
    }

    public isClosed(): boolean {
        return this._status === JobStatus.Resolved || this._status === JobStatus.Failed;
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

    get publishedAt(): number {
        return parseInt(this.tagValue('published_at') ?? '0');
    }

    set publishedAt(publishedAt: number) {
        this.removeTag('published_at');
        this.tags.push(['published_at', publishedAt.toString()]);
    }

    /**
     * Adds a state history entry when status changes
     * @param oldStatus Previous job status
     */
    addStateHistory(oldStatus: JobStatus, timestamp?: number) {
        timestamp = timestamp ?? Math.floor(Date.now() / 1000);

        this.tags.push([
            'state_history',
            oldStatus.toString(),
            this._status.toString(),
            timestamp.toString(),
        ]);
    }

    /**
     * Gets the complete state history of the job
     * @returns Array of state transitions with timestamps
     */
    get stateHistory(): Array<{ fromStatus: JobStatus; toStatus: JobStatus; timestamp: number }> {
        return this.tags
            .filter((tag: NDKTag) => tag[0] === 'state_history')
            .map((tag: NDKTag) => ({
                fromStatus: parseInt(tag[1]) as JobStatus,
                toStatus: parseInt(tag[2]) as JobStatus,
                timestamp: parseInt(tag[3]),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }
}
