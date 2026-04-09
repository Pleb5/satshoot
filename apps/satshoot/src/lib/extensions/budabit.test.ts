import { describe, expect, it } from 'vitest';

import { nip19 } from 'nostr-tools';

import {
    GIT_STATUS_CLOSED,
    GIT_STATUS_DRAFT,
    GIT_STATUS_OPEN,
    GIT_STATUS_RESOLVED,
    buildDraftFromExistingJob,
    buildRepoIssueSummaries,
    buildRepoSystemTags,
    buildUnsignedJobEvent,
    createBudabitContextFromRepo,
    getEditableJobTags,
    getIssueIdFromTags,
    getRepoAddressesFromContext,
    getRepoAddressesFromTags,
    mergeBudabitContexts,
    parseBudabitRepoContextFromReferrer,
} from '$lib/extensions/budabit';

describe('budabit extension helpers', () => {
    it('derives effective repo addresses from repo owner and maintainers', () => {
        expect(
            getRepoAddressesFromContext({
                repo: {
                    repoPubkey: 'owner',
                    repoName: 'satshoot',
                    maintainers: ['alice', 'owner', 'bob'],
                },
            })
        ).toEqual(['30617:owner:satshoot', '30617:alice:satshoot', '30617:bob:satshoot']);
    });

    it('builds and extracts repo and issue system tags', () => {
        const tags = buildRepoSystemTags(
            ['30617:owner:satshoot', '30617:alice:satshoot'],
            'issue-1'
        );

        expect(getRepoAddressesFromTags(tags)).toEqual([
            '30617:owner:satshoot',
            '30617:alice:satshoot',
        ]);
        expect(getIssueIdFromTags(tags)).toBe('issue-1');
    });

    it('filters system tags out of editable tag lists', () => {
        expect(
            getEditableJobTags([
                ['t', 'svelte'],
                ['t', 'repo:30617:owner:satshoot'],
                ['t', 'issue:abc123'],
                ['repo', '30617:owner:satshoot'],
            ])
        ).toEqual(['svelte']);
    });

    it('resolves issue status from the latest trusted status event', () => {
        const issues = [
            {
                id: 'issue-1',
                pubkey: 'author',
                created_at: 10,
                content: 'Issue body',
                tags: [
                    ['subject', 'Issue title'],
                    ['t', 'bug'],
                ],
            },
        ];

        const statuses = [
            {
                pubkey: 'maintainer',
                created_at: 11,
                kind: GIT_STATUS_OPEN,
                tags: [['e', 'issue-1']],
            },
            {
                pubkey: 'maintainer',
                created_at: 12,
                kind: GIT_STATUS_DRAFT,
                tags: [['e', 'issue-1']],
            },
            {
                pubkey: 'maintainer',
                created_at: 13,
                kind: GIT_STATUS_RESOLVED,
                tags: [['e', 'issue-1']],
            },
            {
                pubkey: 'outsider',
                created_at: 14,
                kind: GIT_STATUS_CLOSED,
                tags: [['e', 'issue-1']],
            },
        ];

        expect(buildRepoIssueSummaries(issues, statuses, ['maintainer'])[0].status).toBe(
            'resolved'
        );
    });

    it('creates repo draft data from an existing repo-bound job', () => {
        const draft = buildDraftFromExistingJob(
            {
                title: 'Fix bug',
                description: 'Ship fix',
                tags: [
                    ['t', 'svelte'],
                    ['repo', '30617:owner:satshoot'],
                    ['t', 'repo:30617:owner:satshoot'],
                    ['issue', 'issue-1'],
                ],
            } as any,
            {
                repo: {
                    repoName: 'satshoot',
                    repoNaddr: 'naddr1test',
                },
            },
            'budabit'
        );

        expect(draft).toMatchObject({
            origin: 'existing',
            repoAddresses: ['30617:owner:satshoot'],
            issueId: 'issue-1',
            tags: ['svelte'],
        });
    });

    it('merges fallback repo context with live Budabit user context', () => {
        expect(
            mergeBudabitContexts(
                createBudabitContextFromRepo({
                    repoPubkey: 'owner',
                    repoName: 'satshoot',
                    repoNaddr: 'naddr1repo',
                    repoRelays: ['wss://relay.one'],
                }),
                {
                    userPubkey: 'current-user',
                    relays: ['wss://relay.two'],
                    repo: {
                        repoPubkey: 'owner',
                        repoName: 'satshoot',
                        repoRelays: ['wss://relay.three'],
                        maintainers: ['alice'],
                    },
                }
            )
        ).toEqual({
            contextId: 'repo:owner:satshoot',
            userPubkey: 'current-user',
            relays: ['wss://relay.one', 'wss://relay.two'],
            repo: {
                repoPubkey: 'owner',
                repoName: 'satshoot',
                repoNaddr: 'naddr1repo',
                repoRelays: ['wss://relay.one', 'wss://relay.three'],
                maintainers: ['owner', 'alice'],
            },
        });
    });

    it('parses Budabit repo context from the embedding page URL', () => {
        const repoNaddr = nip19.naddrEncode({
            identifier: 'nostr-git',
            pubkey: '9c6e4f0c0f0c7fe859d5d5f1f82ea1f98ffb5f59d4aa8d4d4ce9a2b859ccf7fb',
            kind: 30617,
            relays: ['wss://relay.example'],
        });

        expect(
            parseBudabitRepoContextFromReferrer(
                `https://budabit.test/spaces/relay/git/${repoNaddr}/extensions/satshoot`
            )
        ).toEqual({
            contextId:
                'repo:9c6e4f0c0f0c7fe859d5d5f1f82ea1f98ffb5f59d4aa8d4d4ce9a2b859ccf7fb:nostr-git',
            relays: ['wss://relay.example'],
            repo: {
                repoPubkey: '9c6e4f0c0f0c7fe859d5d5f1f82ea1f98ffb5f59d4aa8d4d4ce9a2b859ccf7fb',
                repoName: 'nostr-git',
                repoNaddr,
                repoRelays: ['wss://relay.example'],
                maintainers: ['9c6e4f0c0f0c7fe859d5d5f1f82ea1f98ffb5f59d4aa8d4d4ce9a2b859ccf7fb'],
            },
        });
    });

    it('uses the Budabit relay path segment as a relay fallback', () => {
        const repoNaddr = nip19.naddrEncode({
            identifier: 'nostr-git',
            pubkey: '9c6e4f0c0f0c7fe859d5d5f1f82ea1f98ffb5f59d4aa8d4d4ce9a2b859ccf7fb',
            kind: 30617,
            relays: [],
        });

        expect(
            parseBudabitRepoContextFromReferrer(
                `https://budabit.test/spaces/${encodeURIComponent('wss://repo.relay')}/git/${repoNaddr}/extensions/satshoot`
            )?.repo?.repoRelays
        ).toEqual(['wss://repo.relay']);
    });

    it('builds unsigned repo job events with repo linkage tags', () => {
        const event = buildUnsignedJobEvent({
            title: 'Fix parser',
            description: 'Need help with parser bug',
            manualTags: ['TypeScript', 'nostr'],
            repoDraft: {
                origin: 'issue',
                repoAddresses: ['30617:owner:satshoot'],
                issueId: 'issue-1',
                title: 'Fix parser',
                description: 'Need help with parser bug',
                tags: ['typescript'],
            },
            pubkey: 'owner',
        });

        expect(event.kind).toBe(32767);
        expect(event.pubkey).toBe('owner');
        expect(event.tags).toContainEqual(['repo', '30617:owner:satshoot']);
        expect(event.tags).toContainEqual(['t', 'repo:30617:owner:satshoot']);
        expect(event.tags).toContainEqual(['issue', 'issue-1']);
        expect(event.tags).toContainEqual(['t', 'typescript']);
        expect(event.tags).toContainEqual(['t', 'nostr']);
    });
});
