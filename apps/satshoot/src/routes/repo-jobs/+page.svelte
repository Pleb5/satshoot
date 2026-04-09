<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

    import type { NDKEvent, NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
    import { NDKRelay, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { onDestroy } from 'svelte';

    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import {
        GIT_ISSUE,
        GIT_STATUS_CLOSED,
        GIT_STATUS_DRAFT,
        GIT_STATUS_OPEN,
        GIT_STATUS_RESOLVED,
        buildRepoIssueSummaries,
        buildRepoJobDraft,
        buildRepoTagValue,
        dedupeLatestJobs,
        extensionContext,
        getPrimaryRepoAddress,
        getRepoAddressesFromContext,
        repoJobDraft,
        type RepoIssueSummary,
        withEmbedMode,
    } from '$lib/extensions/budabit';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ndk from '$lib/stores/session';
    import { toaster } from '$lib/stores/toaster';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import IdentityBadge from '$lib/extensions/IdentityBadge.svelte';

    enum RepoJobTab {
        Open,
        InProgress,
        Closed,
        All,
    }

    const embedMode = $derived(page.url.searchParams.get('embed'));
    const budabitEmbed = $derived(embedMode === 'budabit');
    const repoName = $derived($extensionContext?.repo?.repoName || 'Repository');
    const repoNaddr = $derived($extensionContext?.repo?.repoNaddr || '');
    const repoAddresses = $derived(getRepoAddressesFromContext($extensionContext));
    const primaryRepoAddress = $derived(getPrimaryRepoAddress($extensionContext));
    const repoTagValues = $derived(repoAddresses.map(buildRepoTagValue));
    const repoRelays = $derived.by(() =>
        Array.from(
            new Set([
                ...($extensionContext?.repo?.repoRelays || []),
                ...($extensionContext?.relays || []),
            ]),
        ),
    );
    const maintainers = $derived.by(() =>
        Array.from(
            new Set([
                $extensionContext?.repo?.repoPubkey,
                ...($extensionContext?.repo?.maintainers || []),
            ].filter(Boolean)),
        ) as string[],
    );

    const repoJobsFilter: NDKFilter = {
        kinds: [32767 as NDKKind],
    };
    const repoIssuesFilter: NDKFilter = {
        kinds: [GIT_ISSUE as NDKKind],
    };
    const repoStatusesFilter: NDKFilter = {
        kinds: [
            GIT_STATUS_OPEN as NDKKind,
            GIT_STATUS_RESOLVED as NDKKind,
            GIT_STATUS_CLOSED as NDKKind,
            GIT_STATUS_DRAFT as NDKKind,
        ],
    };

    const subOptions = {
        autoStart: false,
        closeOnEose: false,
        groupable: true,
        groupableDelay: 500,
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
    };

    const repoJobs = $ndk.storeSubscribe<JobEvent>(repoJobsFilter, subOptions, JobEvent);
    const repoIssues = $ndk.storeSubscribe<NDKEvent>(repoIssuesFilter, subOptions);
    const repoStatuses = $ndk.storeSubscribe<NDKEvent>(repoStatusesFilter, subOptions);

    let selectedTab = $state<RepoJobTab>(RepoJobTab.Open);
    let issuePickerOpen = $state(false);
    let includeClosedIssues = $state(false);
    let issueSearch = $state('');
    let subscriptionKey = $state('');
    let connectedRelayKey = '';
    const attachedRepoRelays = new Set<string>();

    const tabs = $derived.by(() => {
        const jobs = dedupeLatestJobs($repoJobs);
        const openCount = jobs.filter(job => job.status === JobStatus.New).length;
        const inProgressCount = jobs.filter(job => job.status === JobStatus.InProgress).length;
        const closedCount = jobs.filter(job => job.isClosed()).length;

        return [
            { id: RepoJobTab.Open, label: `Open (${openCount})` },
            { id: RepoJobTab.InProgress, label: `In Progress (${inProgressCount})` },
            { id: RepoJobTab.Closed, label: `Closed (${closedCount})` },
            { id: RepoJobTab.All, label: `All (${jobs.length})` },
        ];
    });

    const repoIssuesWithStatus = $derived(
        buildRepoIssueSummaries($repoIssues as any, $repoStatuses as any, maintainers),
    );

    const filteredIssues = $derived.by(() => {
        const search = issueSearch.trim().toLowerCase();

        return repoIssuesWithStatus.filter(issue => {
            const visible = includeClosedIssues
                ? true
                : issue.status === 'open' || issue.status === 'draft';

            if (!visible) return false;
            if (!search) return true;

            const haystack = [issue.subject, issue.content, issue.labels.join(' ')].join(' ').toLowerCase();
            return haystack.includes(search);
        });
    });

    const filteredJobs = $derived.by(() => {
        const jobs = dedupeLatestJobs($repoJobs);

        switch (selectedTab) {
            case RepoJobTab.Open:
                return jobs.filter(job => job.status === JobStatus.New);
            case RepoJobTab.InProgress:
                return jobs.filter(job => job.status === JobStatus.InProgress);
            case RepoJobTab.Closed:
                return jobs.filter(job => job.isClosed());
            case RepoJobTab.All:
            default:
                return jobs;
        }
    });

    const hostIdentity = $derived($extensionContext?.userPubkey || null);
    const satshootIdentity = $derived($currentUser?.pubkey || null);
    const identityMatches = $derived(
        !hostIdentity || !satshootIdentity ? null : hostIdentity === satshootIdentity,
    );
    const hostContextState = $derived.by(() => {
        if (hostIdentity) return 'connected';
        if (primaryRepoAddress) return 'repo-only';
        return 'waiting';
    });
    const signingSummary = $derived.by(() => {
        if (!budabitEmbed) {
            return $loggedIn
                ? 'Signed in to SatShoot directly.'
                : 'Browse only until you sign in to SatShoot.';
        }

        if (hostIdentity) {
            return 'Budabit will sign and publish repo jobs as the current Budabit user.';
        }

        if (primaryRepoAddress) {
            return 'Repo context is loaded, but Budabit has not resent the current user pubkey yet.';
        }

        return 'Waiting for Budabit to provide repo and signer context.';
    });

    $effect(() => {
        const urls = repoRelays.filter(Boolean);
        const nextRelayKey = urls.slice().sort().join('|');

        if (!nextRelayKey || nextRelayKey === connectedRelayKey) return;

        connectedRelayKey = nextRelayKey;

        urls.forEach(url => {
            if (!attachedRepoRelays.has(url)) {
                attachedRepoRelays.add(url);
                $ndk.pool.addRelay(new NDKRelay(url, undefined, $ndk));
            }
        });

        $ndk.connect(2500).catch((error) => {
            console.warn('Failed to connect repo relays for Budabit embed:', error);
        });
    });

    $effect(() => {
        const issueAddresses = repoAddresses;
        const jobTags = repoTagValues;

        if (issueAddresses.length === 0 || jobTags.length === 0) {
            if (subscriptionKey) {
                repoJobs.empty();
                repoIssues.empty();
                repoStatuses.empty();
                repoJobs.unsubscribe?.();
                repoIssues.unsubscribe?.();
                repoStatuses.unsubscribe?.();
                subscriptionKey = '';
            }

            return;
        }

        const nextKey = `${issueAddresses.slice().sort().join('|')}::${jobTags.slice().sort().join('|')}`;
        if (nextKey === subscriptionKey) return;

        subscriptionKey = nextKey;
        repoJobsFilter['#t'] = jobTags;
        repoIssuesFilter['#a'] = issueAddresses;
        repoStatusesFilter['#a'] = issueAddresses;

        repoJobs.changeFilters?.([repoJobsFilter]);
        repoIssues.changeFilters?.([repoIssuesFilter]);
        repoStatuses.changeFilters?.([repoStatusesFilter]);

        repoJobs.startSubscription();
        repoIssues.startSubscription();
        repoStatuses.startSubscription();
    });

    function startDraft(issue?: RepoIssueSummary) {
        const draft = buildRepoJobDraft($extensionContext, embedMode, issue);

        if (!draft) {
            toaster.error({
                title: 'Repo context is not ready yet.',
            });
            return;
        }

        $repoJobDraft = draft;
        goto(withEmbedMode('/post-job', embedMode));
    }

    function getStatusClasses(status: RepoIssueSummary['status']) {
        switch (status) {
            case 'draft':
                return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300';
            case 'closed':
                return 'bg-red-500/15 text-red-700 dark:text-red-300';
            case 'resolved':
                return 'bg-green-500/15 text-green-700 dark:text-green-300';
            case 'open':
            default:
                return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
        }
    }

    function getStatusLabel(status: RepoIssueSummary['status']) {
        switch (status) {
            case 'draft':
                return 'Draft';
            case 'closed':
                return 'Closed';
            case 'resolved':
                return 'Resolved';
            case 'open':
            default:
                return 'Open';
        }
    }

    function truncate(value: string, maxLength = 180) {
        if (value.length <= maxLength) return value;
        return `${value.slice(0, maxLength).trim()}...`;
    }

    onDestroy(() => {
        repoJobs.unsubscribe?.();
        repoIssues.unsubscribe?.();
        repoStatuses.unsubscribe?.();

        repoJobs.empty?.();
        repoIssues.empty?.();
        repoStatuses.empty?.();
    });
</script>

<svelte:head>
    <title>{repoName} Jobs | SatShoot</title>
</svelte:head>

<div class="box-border w-full max-w-full min-h-full overflow-x-hidden px-[10px] py-[14px] sm:px-[16px] sm:py-[18px]">
    <div class="flex w-full max-w-full flex-col gap-[20px] overflow-x-hidden">
    <Card classes="max-w-full gap-[14px] overflow-x-hidden border-[1px] border-black-100 dark:border-white-100">
        <div class="flex min-w-0 flex-col gap-[12px] lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1 flex flex-col gap-[8px]">
                <div class="flex flex-wrap items-center gap-[10px]">
                    <span
                        class="inline-flex items-center rounded-full bg-blue-500/15 px-[10px] py-[4px] text-[12px] font-[700] uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300"
                    >
                        Budabit Repo Mode
                    </span>
                    {#if primaryRepoAddress}
                        <span
                            class="inline-flex items-center rounded-full bg-black-100 px-[10px] py-[4px] text-[12px] font-[600] text-black-400 dark:bg-white-100 dark:text-white-300"
                        >
                            {repoAddresses.length} repo IDs
                        </span>
                    {/if}
                </div>

                <div class="flex min-w-0 flex-col gap-[4px]">
                    <h1 class="break-words text-[24px] font-[700] leading-[1.05] sm:text-[30px]">{repoName} Jobs</h1>
                    <p class="max-w-[780px] text-[15px] text-black-300 dark:text-white-300">
                        Turn repo issues into paid gigs and keep all repo-bound job status in one place.
                    </p>
                </div>
            </div>

            <div class="grid w-full min-w-0 grid-cols-1 gap-[10px] sm:grid-cols-2 lg:w-[320px] lg:flex-none lg:grid-cols-1">
                <Button onClick={() => (issuePickerOpen = !issuePickerOpen)}>
                    <i class="bx bxs-collection"></i>
                    {issuePickerOpen ? 'Hide Issue Picker' : 'Create From Issue'}
                </Button>
                <Button variant="outlined" onClick={() => startDraft()}>
                    <i class="bx bxs-briefcase"></i>
                    New Custom Repo Job
                </Button>
            </div>
        </div>

        <div class="grid gap-[10px] lg:grid-cols-3">
            <div class="min-w-0 rounded-[8px] bg-black-50 p-[10px] dark:bg-black-100">
                <p class="text-[11px] font-[700] uppercase tracking-[0.08em] text-black-300 dark:text-white-300">
                    Host Identity
                </p>
                <div class="mt-[8px]">
                    <IdentityBadge
                        pubkey={hostIdentity}
                        sizeClasses="w-9 h-9"
                        emptyText={
                            hostContextState === 'repo-only'
                                ? 'Repo context loaded, user pubkey missing.'
                                : 'Waiting for Budabit context.'
                        }
                        helperText={
                            hostContextState === 'repo-only'
                                ? 'Reload the repo tab if this stays empty.'
                                : 'Open from a Budabit repo tab.'
                        }
                    />
                </div>
            </div>
            <div class="min-w-0 rounded-[8px] bg-black-50 p-[10px] dark:bg-black-100">
                <p class="text-[11px] font-[700] uppercase tracking-[0.08em] text-black-300 dark:text-white-300">
                    SatShoot Session
                </p>
                <div class="mt-[8px]">
                    <IdentityBadge
                        pubkey={satshootIdentity}
                        sizeClasses="w-9 h-9"
                        emptyText="Anonymous view"
                        helperText={
                            budabitEmbed
                                ? 'SatShoot login is optional here.'
                                : 'Sign in to SatShoot to manage jobs directly.'
                        }
                    />
                </div>
            </div>
            <div class="min-w-0 rounded-[8px] bg-black-50 p-[10px] dark:bg-black-100">
                <p class="text-[11px] font-[700] uppercase tracking-[0.08em] text-black-300 dark:text-white-300">
                    Signing Mode
                </p>
                <p class="mt-[6px] text-[14px] font-[700] text-black-500 dark:text-white">
                    {#if budabitEmbed}
                        {hostIdentity ? 'Budabit signer ready' : 'Budabit signer required'}
                    {:else if $loggedIn}
                        SatShoot signer ready
                    {:else}
                        View only
                    {/if}
                </p>
                <p class="mt-[4px] text-[12px] text-black-300 dark:text-white-300">
                    {signingSummary}
                </p>
                {#if identityMatches === false}
                    <p class="mt-[4px] text-[12px] text-yellow-700 dark:text-yellow-300">
                        Budabit and SatShoot are using different pubkeys right now. That is fine for browsing,
                        but repo job publishing will still use the Budabit identity above.
                    </p>
                {/if}
            </div>
        </div>

        {#if repoNaddr || primaryRepoAddress}
            <details class="group rounded-[8px] border border-black-100 bg-black-50 px-[10px] py-[8px] dark:border-white-100 dark:bg-black-100">
                <summary class="cursor-pointer list-none text-[12px] font-[700] uppercase tracking-[0.08em] text-black-300 dark:text-white-300">
                    Repo Details
                </summary>
                <div class="mt-[10px] flex flex-col gap-[8px] text-[12px] text-black-300 dark:text-white-300">
                    {#if repoNaddr}
                        <p class="break-all">Repo naddr: {repoNaddr}</p>
                    {/if}
                    {#if primaryRepoAddress}
                        <p class="break-all">Canonical repo id: {primaryRepoAddress}</p>
                    {/if}
                </div>
            </details>
        {/if}
    </Card>

    {#if issuePickerOpen}
        <Card classes="max-w-full gap-[14px] overflow-x-hidden border-[1px] border-black-100 dark:border-white-100">
            <div class="flex flex-col gap-[10px] lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 class="text-[24px] font-[700]">Issue Picker</h2>
                    <p class="text-[14px] text-black-300 dark:text-white-300">
                        Open and draft issues show first so job creation stays focused on active work.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-[10px]">
                    <Button
                        variant={includeClosedIssues ? 'contained' : 'outlined'}
                        onClick={() => (includeClosedIssues = !includeClosedIssues)}
                    >
                        {includeClosedIssues ? 'Closed Issues Included' : 'Only Open + Draft'}
                    </Button>
                </div>
            </div>

            <Input
                bind:value={issueSearch}
                placeholder="Search by title, body, or labels"
                fullWidth
            />

            {#if filteredIssues.length > 0}
                <div class="max-h-[320px] overflow-y-auto pr-[2px]">
                    <div class="grid max-w-full gap-[12px] xl:grid-cols-2">
                        {#each filteredIssues as issue (issue.id)}
                            <Card classes="max-w-full gap-[10px] overflow-x-hidden border-[1px] border-black-100 dark:border-white-100">
                                <div class="flex min-w-0 flex-col gap-[10px] sm:flex-row sm:items-start sm:justify-between">
                                    <div class="min-w-0 flex-1 flex flex-col gap-[6px]">
                                        <h3 class="break-words text-[16px] font-[700] leading-[1.2]">{issue.subject}</h3>
                                        <div class="flex flex-wrap items-center gap-[8px] text-[12px] text-black-300 dark:text-white-300">
                                            <span
                                                class={`inline-flex rounded-full px-[8px] py-[3px] font-[700] ${getStatusClasses(issue.status)}`}
                                            >
                                                {getStatusLabel(issue.status)}
                                            </span>
                                            <span>{new Date(issue.createdAt * 1000).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <Button classes="w-full sm:w-auto sm:shrink-0" onClick={() => startDraft(issue)}>
                                        Use This Issue
                                    </Button>
                                </div>

                                <p class="break-words text-[13px] leading-[1.5] text-black-400 dark:text-white-300">
                                    {truncate(issue.content || 'No issue description available yet.')}
                                </p>

                                {#if issue.labels.length > 0}
                                    <div class="flex flex-wrap gap-[8px]">
                                        {#each issue.labels as label}
                                            <span class="max-w-full break-all rounded-full bg-black-100 px-[10px] py-[4px] text-[12px] font-[600] text-black-400 dark:bg-white-100 dark:text-white-300">
                                                {label}
                                            </span>
                                        {/each}
                                    </div>
                                {/if}
                            </Card>
                        {/each}
                    </div>
                </div>
            {:else}
                <Card classes="items-center border-[1px] border-dashed border-black-100 text-center dark:border-white-100">
                    <h3 class="text-[20px] font-[700]">No matching repo issues</h3>
                    <p class="max-w-[520px] text-[14px] text-black-300 dark:text-white-300">
                        Try another search, include closed issues, or reload the Budabit tab to reconnect the repo relays.
                    </p>
                </Card>
            {/if}
        </Card>
    {/if}

    <Card classes="max-w-full gap-[16px] overflow-x-hidden border-[1px] border-black-100 dark:border-white-100">
        <div class="flex flex-col gap-[10px] lg:flex-row lg:items-center lg:justify-between">
            <div>
                <h2 class="text-[24px] font-[700]">Repo-Bound Jobs</h2>
                <p class="text-[14px] text-black-300 dark:text-white-300">
                    This feed only shows SatShoot jobs tagged for this repository extension.
                </p>
            </div>
        </div>

        <TabSelector {tabs} bind:selectedTab />

        {#if filteredJobs.length > 0}
            <div class="grid gap-[16px] xl:grid-cols-2">
                {#each filteredJobs as job (job.id)}
                    <JobCard {job} showBidsDetail />
                {/each}
            </div>
        {:else if primaryRepoAddress}
            <Card classes="items-center border-[1px] border-dashed border-black-100 text-center dark:border-white-100">
                <h3 class="text-[20px] font-[700]">No repo jobs yet</h3>
                <p class="max-w-[520px] text-[14px] text-black-300 dark:text-white-300">
                    Create the first repo-bound SatShoot job from an issue or post a custom job for this repo.
                </p>
                <div class="flex flex-wrap justify-center gap-[10px]">
                    <Button onClick={() => (issuePickerOpen = true)}>Open Issue Picker</Button>
                    <Button variant="outlined" onClick={() => startDraft()}>Post Custom Job</Button>
                </div>
            </Card>
        {:else}
            <Card classes="items-center border-[1px] border-dashed border-black-100 text-center dark:border-white-100">
                <h3 class="text-[20px] font-[700]">Waiting for Budabit repo context</h3>
                <p class="max-w-[520px] text-[14px] text-black-300 dark:text-white-300">
                    Open this page from Budabit's repo extension tab so SatShoot can scope itself to the current repository.
                </p>
            </Card>
        {/if}
    </Card>
    </div>
</div>
