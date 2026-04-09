import { writable } from 'svelte/store';
import { nip19 } from 'nostr-tools';

import type { JobEvent } from '$lib/events/JobEvent';

export const GIT_ISSUE = 1621;
export const GIT_STATUS_OPEN = 1630;
export const GIT_STATUS_RESOLVED = 1631;
export const GIT_STATUS_CLOSED = 1632;
export const GIT_STATUS_DRAFT = 1633;

export type RepoIssueStatus = 'open' | 'draft' | 'closed' | 'resolved';

export interface BudabitRepoPayload {
    repoPubkey?: string;
    repoName?: string;
    repoNaddr?: string;
    repoRelays?: string[];
    maintainers?: string[];
}

export interface BudabitExtensionContext {
    contextId?: string;
    userPubkey?: string;
    relays?: string[];
    repo?: BudabitRepoPayload;
}

export interface RepoIssueEventLike {
    id: string;
    pubkey: string;
    created_at?: number;
    content: string;
    tags: string[][];
}

export interface RepoStatusEventLike {
    id?: string;
    pubkey: string;
    created_at?: number;
    kind: number;
    tags: string[][];
}

export interface RepoIssueSummary {
    id: string;
    subject: string;
    content: string;
    labels: string[];
    createdAt: number;
    pubkey: string;
    status: RepoIssueStatus;
}

export interface RepoJobDraft {
    origin: 'issue' | 'manual' | 'existing';
    embedMode?: string | null;
    repoName?: string;
    repoNaddr?: string;
    repoAddresses: string[];
    issueId?: string;
    issueSubject?: string;
    title: string;
    description: string;
    tags: string[];
}

export const extensionContext = writable<BudabitExtensionContext | null>(null);
export const repoJobDraft = writable<RepoJobDraft | null>(null);

const unique = <T>(items: T[]) => Array.from(new Set(items));

export const normalizeTagValue = (value: string) => value.replaceAll(' ', '_').toLowerCase();

const getTagValues = (tags: string[][], name: string) =>
    tags
        .filter((tag) => tag[0] === name)
        .map((tag) => tag[1])
        .filter(Boolean) as string[];

const getSingleTagValue = (tags: string[][], name: string) =>
    tags.find((tag) => tag[0] === name)?.[1];

export function getEmbedMode(url: URL | string): string | null {
    const current = typeof url === 'string' ? new URL(url, 'https://satshoot.local') : url;
    return current.searchParams.get('embed');
}

export function withEmbedMode(path: string, embedMode?: string | null): string {
    if (!embedMode) return path;

    const url = new URL(path, 'https://satshoot.local');
    url.searchParams.set('embed', embedMode);
    return `${url.pathname}${url.search}${url.hash}`;
}

export function getRepoAddressesFromContext(
    context: BudabitExtensionContext | null | undefined
): string[] {
    const repoPubkey = context?.repo?.repoPubkey;
    const repoName = context?.repo?.repoName;

    if (!repoPubkey || !repoName) return [];

    return unique([repoPubkey, ...(context?.repo?.maintainers || [])].filter(Boolean)).map(
        (pubkey) => `30617:${pubkey}:${repoName}`
    );
}

export function getPrimaryRepoAddress(
    context: BudabitExtensionContext | null | undefined
): string | null {
    const repoPubkey = context?.repo?.repoPubkey;
    const repoName = context?.repo?.repoName;

    if (!repoPubkey || !repoName) return null;

    return `30617:${repoPubkey}:${repoName}`;
}

export const buildRepoTagValue = (repoAddress: string) => `repo:${repoAddress}`;
export const buildIssueTagValue = (issueId: string) => `issue:${issueId}`;

export function mergeBudabitContexts(
    current: BudabitExtensionContext | null | undefined,
    next: BudabitExtensionContext | null | undefined
): BudabitExtensionContext | null {
    if (!current && !next) return null;
    if (!current) return next || null;
    if (!next) return current;

    return {
        contextId: next.contextId || current.contextId,
        userPubkey: next.userPubkey || current.userPubkey,
        relays: unique([...(current.relays || []), ...(next.relays || [])]),
        repo: {
            repoPubkey: next.repo?.repoPubkey || current.repo?.repoPubkey,
            repoName: next.repo?.repoName || current.repo?.repoName,
            repoNaddr: next.repo?.repoNaddr || current.repo?.repoNaddr,
            repoRelays: unique([
                ...(current.repo?.repoRelays || []),
                ...(next.repo?.repoRelays || []),
            ]),
            maintainers: unique([
                ...(current.repo?.maintainers || []),
                ...(next.repo?.maintainers || []),
            ]),
        },
    };
}

export function createBudabitContextFromRepo(args: {
    repoPubkey?: string;
    repoName?: string;
    repoNaddr?: string;
    repoRelays?: string[];
    maintainers?: string[];
}): BudabitExtensionContext | null {
    if (!args.repoPubkey || !args.repoName) return null;

    const repoRelays = unique(args.repoRelays || []);

    return {
        contextId: `repo:${args.repoPubkey}:${args.repoName}`,
        relays: repoRelays,
        repo: {
            repoPubkey: args.repoPubkey,
            repoName: args.repoName,
            repoNaddr: args.repoNaddr,
            repoRelays,
            maintainers: unique([args.repoPubkey, ...(args.maintainers || [])].filter(Boolean)),
        },
    };
}

export function parseBudabitRepoContextFromReferrer(
    referrer: string | null | undefined
): BudabitExtensionContext | null {
    if (!referrer) return null;

    try {
        const url = new URL(referrer);
        const segments = url.pathname.split('/').filter(Boolean);
        const gitIndex = segments.indexOf('git');
        const relaySegment = segments[0] === 'spaces' ? segments[1] : undefined;
        const relayHintRaw = relaySegment ? decodeURIComponent(relaySegment) : undefined;
        const relayHint =
            relayHintRaw && (relayHintRaw.startsWith('wss://') || relayHintRaw.startsWith('ws://'))
                ? relayHintRaw
                : undefined;
        const naddrCandidate =
            (gitIndex >= 0 ? segments[gitIndex + 1] : undefined) ||
            segments.find((segment) => segment.startsWith('naddr1'));

        if (!naddrCandidate) return null;

        const decoded = nip19.decode(naddrCandidate);
        if (decoded.type !== 'naddr') return null;

        const data = decoded.data as {
            pubkey?: string;
            identifier?: string;
            relays?: string[];
        };

        return createBudabitContextFromRepo({
            repoPubkey: data.pubkey,
            repoName: data.identifier,
            repoNaddr: naddrCandidate,
            repoRelays: unique([...(data.relays || []), ...(relayHint ? [relayHint] : [])]),
        });
    } catch {
        return null;
    }
}

export function buildRepoSystemTags(repoAddresses: string[], issueId?: string): string[][] {
    const normalizedAddresses = unique(repoAddresses.filter(Boolean));
    const tags = normalizedAddresses.flatMap((address) => [
        ['repo', address],
        ['t', buildRepoTagValue(address)],
    ]);

    if (issueId) {
        tags.push(['issue', issueId], ['t', buildIssueTagValue(issueId)]);
    }

    return tags;
}

export function getRepoAddressesFromTags(tags: string[][]): string[] {
    return unique([
        ...getTagValues(tags, 'repo'),
        ...getTagValues(tags, 't')
            .filter((tag) => tag.startsWith('repo:'))
            .map((tag) => tag.slice('repo:'.length)),
    ]);
}

export function getIssueIdFromTags(tags: string[][]): string | undefined {
    const explicit = getSingleTagValue(tags, 'issue');
    if (explicit) return explicit;

    return getTagValues(tags, 't')
        .find((tag) => tag.startsWith('issue:'))
        ?.slice('issue:'.length);
}

export function getEditableJobTags(tags: string[][]): string[] {
    return getTagValues(tags, 't').filter(
        (tag) => !tag.startsWith('repo:') && !tag.startsWith('issue:')
    );
}

export function parseRepoIssueEvent(event: RepoIssueEventLike): Omit<RepoIssueSummary, 'status'> {
    return {
        id: event.id,
        subject: getSingleTagValue(event.tags, 'subject') || 'Untitled issue',
        content: event.content,
        labels: getTagValues(event.tags, 't'),
        createdAt: event.created_at ?? 0,
        pubkey: event.pubkey,
    };
}

export function resolveRepoIssueStatus(
    issueId: string,
    statusEvents: RepoStatusEventLike[],
    maintainers: string[]
): RepoIssueStatus {
    const trustedPubkeys = new Set(maintainers.filter(Boolean));

    const relevant = statusEvents
        .filter((event) => event.tags.some((tag) => tag[0] === 'e' && tag[1] === issueId))
        .filter((event) => trustedPubkeys.size === 0 || trustedPubkeys.has(event.pubkey))
        .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

    const latest = relevant[0];

    if (!latest) return 'open';

    switch (latest.kind) {
        case GIT_STATUS_DRAFT:
            return 'draft';
        case GIT_STATUS_CLOSED:
            return 'closed';
        case GIT_STATUS_RESOLVED:
            return 'resolved';
        case GIT_STATUS_OPEN:
        default:
            return 'open';
    }
}

export function buildRepoIssueSummaries(
    issues: RepoIssueEventLike[],
    statusEvents: RepoStatusEventLike[],
    maintainers: string[]
): RepoIssueSummary[] {
    return issues
        .map((issue) => ({
            ...parseRepoIssueEvent(issue),
            status: resolveRepoIssueStatus(issue.id, statusEvents, maintainers),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
}

export function buildRepoJobDraft(
    context: BudabitExtensionContext | null,
    embedMode: string | null,
    issue?: RepoIssueSummary
): RepoJobDraft | null {
    const repoAddresses = getRepoAddressesFromContext(context);

    if (repoAddresses.length === 0) return null;

    return {
        origin: issue ? 'issue' : 'manual',
        embedMode,
        repoName: context?.repo?.repoName,
        repoNaddr: context?.repo?.repoNaddr,
        repoAddresses,
        issueId: issue?.id,
        issueSubject: issue?.subject,
        title: issue?.subject || '',
        description: issue?.content || '',
        tags: unique(issue?.labels || []).map(normalizeTagValue),
    };
}

export function buildDraftFromExistingJob(
    job: Pick<JobEvent, 'title' | 'description' | 'tags'>,
    context: BudabitExtensionContext | null,
    embedMode: string | null
): RepoJobDraft | null {
    const repoAddresses = getRepoAddressesFromTags(job.tags);
    if (repoAddresses.length === 0) return null;

    return {
        origin: 'existing',
        embedMode,
        repoName: context?.repo?.repoName,
        repoNaddr: context?.repo?.repoNaddr,
        repoAddresses,
        issueId: getIssueIdFromTags(job.tags),
        issueSubject: undefined,
        title: job.title,
        description: job.description,
        tags: getEditableJobTags(job.tags).map(normalizeTagValue),
    };
}

export function dedupeLatestJobs(jobs: JobEvent[]): JobEvent[] {
    const latestByAddress = new Map<string, JobEvent>();

    jobs.forEach((job) => {
        const key = job.jobAddress || job.id;
        const existing = latestByAddress.get(key);
        if (!existing || (job.created_at ?? 0) >= (existing.created_at ?? 0)) {
            latestByAddress.set(key, job);
        }
    });

    return Array.from(latestByAddress.values()).sort(
        (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    );
}

export function buildUnsignedJobEvent(args: {
    title: string;
    description: string;
    manualTags: string[];
    repoDraft: RepoJobDraft | null;
    existingDTag?: string;
    pubkey?: string;
}): { kind: number; content: string; created_at: number; tags: string[][]; pubkey?: string } {
    const createdAt = Math.floor(Date.now() / 1000);
    const dedupedManualTags = unique(args.manualTags.filter(Boolean).map(normalizeTagValue));
    const tags: string[][] = [
        ['title', args.title],
        ['s', '0'],
        ['published_at', createdAt.toString()],
        ['d', args.existingDTag || crypto.randomUUID().replaceAll('-', '')],
        ...dedupedManualTags.map((tag) => ['t', tag]),
    ];

    if (args.repoDraft) {
        tags.push(...buildRepoSystemTags(args.repoDraft.repoAddresses, args.repoDraft.issueId));
    }

    return {
        kind: 32767,
        content: args.description,
        created_at: createdAt,
        tags,
        pubkey: args.pubkey,
    };
}
