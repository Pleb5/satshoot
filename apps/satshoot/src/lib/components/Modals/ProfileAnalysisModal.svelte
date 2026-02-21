<script lang="ts">
    import { tick } from 'svelte';
    import { differenceInDays } from 'date-fns';
    import { NDKKind, NDKSubscriptionCacheUsage, type Hexpubkey } from '@nostr-dev-kit/ndk';

    import ndk from '$lib/stores/session';
    import { selectedProviders } from '$lib/stores/assertions';
    import currentUser, { currentUserFreelanceFollowNetwork } from '$lib/stores/user';
    import { allBids, allJobs, allOrders, allServices } from '$lib/stores/freelance-eventstores';
    import { networkWoTScores } from '$lib/stores/wot';
    import satShootWoT from '$lib/stores/satshoot-wot';
    import { toaster } from '$lib/stores/toaster';
    import { AssertionService } from '$lib/services/assertions/AssertionService.svelte';
    import { NIP85_USER_ASSERTION_KIND } from '$lib/services/assertions/AssertionProviderConfig.svelte';
    import type { TrustedProvider, UserAssertion } from '$lib/services/assertions/types';
    import { abbreviateNumber } from '$lib/utils/misc';
    import {
        getCachedVertexReputation,
        requestVertexReputationWithCredits,
        VERTEX_PRICING_URL,
        type VertexReputationCacheEntry,
    } from '$lib/services/vertex/vertex-reputation';

    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import AssertionMetrics from '../UI/Display/AssertionMetrics.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';

    interface Props {
        isOpen: boolean;
        targetPubkey: Hexpubkey;
    }

    type AssertionData = {
        rank?: number;
        followers?: number;
        zapAmtRecd?: number;
        zapAmtSent?: number;
        postCnt?: number;
        replyCnt?: number;
        reactionsCnt?: number;
        zapCntRecd?: number;
        zapCntSent?: number;
        zapAvgAmtDayRecd?: number;
        zapAvgAmtDaySent?: number;
        reportsCntRecd?: number;
        reportsCntSent?: number;
        firstCreatedAt?: number;
        activeHoursStart?: number;
        activeHoursEnd?: number;
        commonTopics?: string[];
        providerCount: number;
    };

    let { isOpen = $bindable(), targetPubkey }: Props = $props();

    let cachedResult = $state<VertexReputationCacheEntry | null>(null);
    let loading = $state(false);
    let loadingCache = $state(false);
    let cacheLoaded = $state(false);
    let loadingSocialFollows = $state(false);
    let cacheStatus = $state<string | null>(null);

    let assertionData = $state<AssertionData | null>(null);
    let assertionLoading = $state(false);
    let assertionStatus = $state<string | null>(null);
    let providerStatusByKey = $state(new Map<string, 'data' | 'no_data'>());
    let userAssertions = $state(new Map<string, UserAssertion>());

    let socialFollows = $state<Set<Hexpubkey>>(new Set());
    let dealLinksViaPartners = $state<Set<Hexpubkey>>(new Set());
    let dealConnectionsLoaded = $state(false);
    let hasDirectDealConnection = $state(false);

    let socialFollowsLoaded = $state(false);

    const isInSocialNetwork = $derived($networkWoTScores.has(targetPubkey));
    const isInFreelanceFollow = $derived($currentUserFreelanceFollowNetwork.has(targetPubkey));
    const isInSatShootWot = $derived(satShootWoT.includes(targetPubkey));
    const isInDealConnections = $derived(hasDirectDealConnection || dealLinksViaPartners.size > 0);

    const selectedUserTags = $derived.by(() => {
        const tags = new Set<string>();
        $selectedProviders.forEach((provider) => {
            if (provider.kind === NIP85_USER_ASSERTION_KIND) {
                tags.add(provider.tag);
            }
        });
        return Array.from(tags);
    });

    const selectedUserProvidersByTag = $derived.by(() => {
        const map = new Map<string, TrustedProvider[]>();
        $selectedProviders.forEach((provider) => {
            if (provider.kind !== NIP85_USER_ASSERTION_KIND) return;
            const list = map.get(provider.tag) ?? [];
            list.push(provider);
            map.set(provider.tag, list);
        });
        return map;
    });

    const selectedUserProvidersByService = $derived.by(() => {
        const map = new Map<string, TrustedProvider>();
        $selectedProviders.forEach((provider) => {
            if (provider.kind !== NIP85_USER_ASSERTION_KIND) return;
            if (!map.has(provider.serviceKey)) {
                map.set(provider.serviceKey, provider);
            }
        });
        return map;
    });

    const dataAgeDays = $derived.by(() => {
        if (!cachedResult) return null;
        return Math.max(0, differenceInDays(new Date(), new Date(cachedResult.fetchedAt)));
    });

    const dataAgeText = $derived.by(() => {
        if (dataAgeDays === null) return null;
        return `${dataAgeDays} day${dataAgeDays === 1 ? '' : 's'} old`;
    });

    const dataAgeClass = $derived.by(() => {
        if (dataAgeDays === null) return '';
        if (dataAgeDays >= 21) return 'text-red-500';
        if (dataAgeDays >= 7) return 'text-yellow-500';
        return '';
    });

    const showErrorToast = (title: string, description?: string) => {
        const needsCreditsAction = (description ?? '').toLowerCase().includes('credits');

        toaster.error({
            title,
            description,
            duration: Infinity,
            action: needsCreditsAction
                ? {
                      label: 'Buy credits',
                      onClick: () => {
                          window.open(VERTEX_PRICING_URL, '_blank', 'noopener,noreferrer');
                      },
                  }
                : undefined,
        });
    };

    const resetSocialFollows = () => {
        socialFollows = new Set();
        socialFollowsLoaded = false;
    };

    const resetDealConnections = () => {
        dealLinksViaPartners = new Set();
        dealConnectionsLoaded = false;
        hasDirectDealConnection = false;
    };

    const filterAssertionsByTag = (
        assertions: Map<string, UserAssertion>,
        tag: string
    ): Map<string, UserAssertion> => {
        const filtered = new Map<string, UserAssertion>();

        assertions.forEach((assertion, key) => {
            const separatorIndex = key.indexOf(':');
            if (separatorIndex === -1) return;
            const assertionTag = key.slice(separatorIndex + 1);

            if (assertionTag === tag) {
                filtered.set(key, assertion);
            }
        });

        return filtered;
    };

    const getProviderCount = (assertions: Map<string, UserAssertion>): number => {
        const providers = new Set<string>();

        assertions.forEach((_, key) => {
            const separatorIndex = key.indexOf(':');
            const serviceKey = separatorIndex === -1 ? key : key.slice(0, separatorIndex);

            if (serviceKey) {
                providers.add(serviceKey);
            }
        });

        return providers.size;
    };

    const getProviderKey = (provider: TrustedProvider): string =>
        `${provider.serviceKey}:${provider.tag}`;

    const tagLabelMap: Record<string, string> = {
        rank: 'WoT Rank',
        followers: 'Followers',
        first_created_at: 'First Activity',
        post_cnt: 'Posts',
        reply_cnt: 'Replies',
        reactions_cnt: 'Reactions',
        zap_amt_recd: 'Zaps Received',
        zap_amt_sent: 'Zaps Sent',
        zap_cnt_recd: 'Zaps Received (count)',
        zap_cnt_sent: 'Zaps Sent (count)',
        zap_avg_amt_day_recd: 'Avg Zaps/day Received',
        zap_avg_amt_day_sent: 'Avg Zaps/day Sent',
        reports_cnt_recd: 'Reports Received',
        reports_cnt_sent: 'Reports Sent',
        active_hours_start: 'Active Hours Start',
        active_hours_end: 'Active Hours End',
        t: 'Common Topics',
    };

    const getTagLabel = (tag: string): string => tagLabelMap[tag] ?? tag;

    const assertionMetricMap: Record<string, keyof AssertionData & keyof UserAssertion> = {
        rank: 'rank',
        followers: 'followers',
        first_created_at: 'firstCreatedAt',
        post_cnt: 'postCnt',
        reply_cnt: 'replyCnt',
        reactions_cnt: 'reactionsCnt',
        zap_amt_recd: 'zapAmtRecd',
        zap_amt_sent: 'zapAmtSent',
        zap_cnt_recd: 'zapCntRecd',
        zap_cnt_sent: 'zapCntSent',
        zap_avg_amt_day_recd: 'zapAvgAmtDayRecd',
        zap_avg_amt_day_sent: 'zapAvgAmtDaySent',
        reports_cnt_recd: 'reportsCntRecd',
        reports_cnt_sent: 'reportsCntSent',
        active_hours_start: 'activeHoursStart',
        active_hours_end: 'activeHoursEnd',
    };

    const summaryUserTags = $derived.by(() => {
        const supportedTags = new Set([...Object.keys(assertionMetricMap), 't']);
        return selectedUserTags.filter(
            (tag) => supportedTags.has(tag) && (selectedUserProvidersByTag.get(tag)?.length ?? 0) === 1
        );
    });

    type MetricFormat = 'rank' | 'number' | 'sats' | 'satsPerDay' | 'date' | 'hour' | 'topics';

    const tagFormatMap: Record<string, MetricFormat> = {
        rank: 'rank',
        followers: 'number',
        first_created_at: 'date',
        post_cnt: 'number',
        reply_cnt: 'number',
        reactions_cnt: 'number',
        zap_amt_recd: 'sats',
        zap_amt_sent: 'sats',
        zap_cnt_recd: 'number',
        zap_cnt_sent: 'number',
        zap_avg_amt_day_recd: 'satsPerDay',
        zap_avg_amt_day_sent: 'satsPerDay',
        reports_cnt_recd: 'number',
        reports_cnt_sent: 'number',
        active_hours_start: 'hour',
        active_hours_end: 'hour',
        t: 'topics',
    };

    const getAssertionValueForTag = (
        assertion: UserAssertion,
        tag: string
    ): number | string[] | string | undefined => {
        if (tag === 't') {
            return assertion.commonTopics;
        }

        const metricKey = assertionMetricMap[tag];
        if (metricKey) {
            const value = assertion[metricKey] as number | undefined;
            if (typeof value === 'number') return value;
        }

        const extraMetrics = (
            assertion as UserAssertion & { extraMetrics?: Record<string, number | string> }
        ).extraMetrics;
        const extraValue = extraMetrics?.[tag];
        if (typeof extraValue === 'number' || typeof extraValue === 'string') {
            return extraValue;
        }

        return undefined;
    };

    const hasAssertionValueForTag = (assertion: UserAssertion, tag: string): boolean => {
        const value = getAssertionValueForTag(assertion, tag);
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'string') return value.length > 0;
        return typeof value === 'number';
    };

    const hasDisplayValue = (value: number | string[] | string | undefined): boolean => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'string') return value.length > 0;
        return typeof value === 'number';
    };

    const getAssertionAvailableTags = (assertion: UserAssertion): string[] => {
        const tags = new Set<string>();
        Object.entries(assertionMetricMap).forEach(([tag, key]) => {
            const value = assertion[key];
            if (typeof value === 'number') {
                tags.add(tag);
            }
        });

        if (assertion.commonTopics && assertion.commonTopics.length > 0) {
            tags.add('t');
        }

        const extraMetrics = (
            assertion as UserAssertion & { extraMetrics?: Record<string, number | string> }
        ).extraMetrics;
        if (extraMetrics) {
            Object.keys(extraMetrics).forEach((tag) => tags.add(tag));
        }

        return Array.from(tags);
    };

    const providerExtrasByService = $derived.by(() => {
        const extras = new Map<
            string,
            { provider: TrustedProvider; metrics: Array<[string, number | string]> }
        >();
        const selectedTagSet = new Set(selectedUserTags);

        userAssertions.forEach((assertion, key) => {
            const separatorIndex = key.indexOf(':');
            if (separatorIndex === -1) return;
            const serviceKey = key.slice(0, separatorIndex);
            if (extras.has(serviceKey)) return;

            const provider = selectedUserProvidersByService.get(serviceKey);
            if (!provider) return;

            const extraMetrics = (
                assertion as UserAssertion & { extraMetrics?: Record<string, number | string> }
            ).extraMetrics;
            if (!extraMetrics) return;

            const metrics = Object.entries(extraMetrics).filter(
                ([tag]) => !selectedTagSet.has(tag)
            );
            if (metrics.length > 0) {
                extras.set(serviceKey, { provider, metrics });
            }
        });

        return extras;
    });

    const formatHour = (value: number): string => {
        const hour = Math.max(0, Math.min(23, Math.round(value)));
        return `${hour.toString().padStart(2, '0')}:00`;
    };

    const formatDate = (value: number): string => new Date(value * 1000).toLocaleDateString();

    const formatAssertionValue = (tag: string, value: number | string[] | string): string => {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
            return value.join(', ');
        }

        const format = tagFormatMap[tag] ?? 'number';
        const isInteger = Number.isInteger(value);
        const absValue = Math.abs(value);

        const formatFloat = () => {
            if (absValue < 1) return value.toPrecision(3);
            return value.toFixed(3);
        };

        if (format === 'rank') return `${isInteger ? Math.round(value) : formatFloat()}/100`;
        if (format === 'sats') {
            return `${isInteger ? abbreviateNumber(value) : formatFloat()} sats`;
        }
        if (format === 'satsPerDay') {
            return `${isInteger ? abbreviateNumber(value) : formatFloat()} sats/day`;
        }
        if (format === 'date') return formatDate(value);
        if (format === 'hour') return formatHour(value);

        if (!isInteger) return formatFloat();
        return abbreviateNumber(value);
    };

    const aggregateUserAssertions = (
        assertions: Map<string, UserAssertion>,
        selectedTags: string[],
        providersByTag: Map<string, TrustedProvider[]>
    ): AssertionData => {
        const data: AssertionData = {
            providerCount: getProviderCount(assertions),
        };

        const tagsToAggregate = selectedTags.length > 0 ? selectedTags : Array.from(providersByTag.keys());

        tagsToAggregate.forEach((tag) => {
            const providers = providersByTag.get(tag) ?? [];
            if (providers.length !== 1) return;

            const providerKey = getProviderKey(providers[0]);
            const assertion = assertions.get(providerKey);
            if (!assertion) return;

            if (tag === 't') {
                const topics = assertion.commonTopics;
                if (topics && topics.length > 0) {
                    data.commonTopics = topics.slice(0, 8);
                }
                return;
            }

            const metricKey = assertionMetricMap[tag];
            if (!metricKey) return;

            const value = assertion[metricKey];
            if (typeof value === 'number') {
                data[metricKey] = value as never;
            }
        });

        return data;
    };

    let assertionRequestId = 0;
    const loadAssertionData = async () => {
        if (!isOpen || !targetPubkey) return;
        if (!$ndk) {
            assertionStatus = 'Trusted assertions unavailable: NDK not ready.';
            assertionData = null;
            userAssertions = new Map();
            return;
        }

        const userProviders = $selectedProviders.filter(
            (provider) => provider.kind === NIP85_USER_ASSERTION_KIND
        );

        if (userProviders.length === 0) {
            assertionData = null;
            providerStatusByKey = new Map();
            userAssertions = new Map();
            assertionStatus =
                'No trusted assertion providers configured. Set providers in Settings to see NIP-85 metrics.';
            return;
        }

        const requestId = ++assertionRequestId;
        assertionLoading = true;
        assertionStatus = null;
        await tick();

        try {
            const globalScope = globalThis as typeof globalThis & { __NIP85_LOG__?: boolean };
            globalScope.__NIP85_LOG__ = true;

            const service = new AssertionService($ndk);
            const assertions = await service.fetchUserAssertions(targetPubkey, userProviders);

            if (requestId !== assertionRequestId) return;

            userAssertions = assertions;
            const statusMap = new Map<string, 'data' | 'no_data'>();
            userProviders.forEach((provider) => {
                const key = getProviderKey(provider);
                const assertion = assertions.get(key);
                const hasData = assertion ? hasAssertionValueForTag(assertion, provider.tag) : false;
                statusMap.set(key, hasData ? 'data' : 'no_data');
            });
            providerStatusByKey = statusMap;

            if (assertions.size === 0) {
                assertionData = null;
                userAssertions = new Map();
                assertionStatus = 'No trusted assertion data found for this user yet.';
                return;
            }

            assertionData = aggregateUserAssertions(
                assertions,
                selectedUserTags,
                selectedUserProvidersByTag
            );
            assertionStatus = assertionData.providerCount
                ? null
                : 'No trusted assertion data found for this user yet.';
        } catch (error) {
            if (requestId !== assertionRequestId) return;
            console.warn('Failed to load trusted assertions:', error);
            assertionData = null;
            userAssertions = new Map();
            providerStatusByKey = new Map();
            assertionStatus = 'Unable to load trusted assertion data.';
        } finally {
            const globalScope = globalThis as typeof globalThis & { __NIP85_LOG__?: boolean };
            globalScope.__NIP85_LOG__ = false;
            if (requestId === assertionRequestId) {
                assertionLoading = false;
            }
        }
    };

    const loadCachedResult = async () => {
        if (loadingCache || cacheStatus) return;
        loadingCache = true;
        cacheStatus = null;
        await tick();

        try {
            cachedResult = (await getCachedVertexReputation(targetPubkey)) ?? null;
            cacheStatus = cachedResult ? 'Fetched from cache' : 'No cached analysis found';
        } catch (error) {
            cachedResult = null;
            cacheStatus = 'No cached analysis found';
            showErrorToast(
                'Unable to load cached analysis',
                error instanceof Error ? error.message : undefined
            );
        } finally {
            cacheLoaded = true;
            loadingCache = false;
        }
    };

    const loadSocialFollows = async () => {
        if (!$currentUser || socialFollowsLoaded || loadingSocialFollows) return;

        loadingSocialFollows = true;

        try {
            const follows = await $currentUser.followSet(
                {
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    closeOnEose: true,
                },
                true,
                NDKKind.Contacts
            );

            socialFollows = follows;
            socialFollowsLoaded = true;
        } catch (error) {
            showErrorToast(
                'Unable to load social follows',
                error instanceof Error ? error.message : undefined
            );
        } finally {
            loadingSocialFollows = false;
        }
    };

    const loadDealConnections = () => {
        if (!$currentUser || dealConnectionsLoaded) return;

        const bidByAddress = new Map<string, (typeof $allBids)[number]>();
        $allBids.forEach((bid) => {
            bidByAddress.set(bid.bidAddress, bid);
        });

        const serviceByAddress = new Map<string, (typeof $allServices)[number]>();
        $allServices.forEach((service) => {
            serviceByAddress.set(service.serviceAddress, service);
        });

        const dealPairs: Array<[Hexpubkey, Hexpubkey]> = [];

        const addDealPair = (left?: Hexpubkey, right?: Hexpubkey) => {
            if (!left || !right || left === right) return;
            dealPairs.push([left, right]);
        };

        $allJobs.forEach((job) => {
            const acceptedBid = job.acceptedBidAddress
                ? bidByAddress.get(job.acceptedBidAddress)
                : undefined;
            addDealPair(job.pubkey, acceptedBid?.pubkey);
        });

        $allOrders.forEach((order) => {
            const service = order.referencedServiceAddress
                ? serviceByAddress.get(order.referencedServiceAddress)
                : undefined;
            addDealPair(order.pubkey, service?.pubkey);
        });

        const directPartners = new Set<Hexpubkey>();
        dealPairs.forEach(([left, right]) => {
            if (left === $currentUser.pubkey) {
                directPartners.add(right);
                return;
            }

            if (right === $currentUser.pubkey) {
                directPartners.add(left);
            }
        });

        hasDirectDealConnection = directPartners.has(targetPubkey);

        const linkPartners = new Set<Hexpubkey>();
        dealPairs.forEach(([left, right]) => {
            if (left === targetPubkey && directPartners.has(right)) {
                linkPartners.add(right);
            }

            if (right === targetPubkey && directPartners.has(left)) {
                linkPartners.add(left);
            }
        });

        dealLinksViaPartners = linkPartners;
        dealConnectionsLoaded = true;
    };

    const runAnalysis = async () => {
        if (!$currentUser) {
            showErrorToast('Sign in to run analysis.');
            return;
        }

        loading = true;
        await tick();

        try {
            const { entry, credits } = await requestVertexReputationWithCredits(
                $ndk,
                targetPubkey,
                $currentUser.pubkey
            );
            cachedResult = entry;

            if (credits) {
                toaster.success({
                    title: `Vertex credits remaining: ${credits.credits}`,
                    duration: 7000,
                });
            }
        } catch (error) {
            showErrorToast(
                'Vertex analysis failed',
                error instanceof Error ? error.message : undefined
            );
        } finally {
            loading = false;
        }
    };

    $effect(() => {
        $currentUser?.pubkey;
        resetSocialFollows();
        resetDealConnections();
    });

    $effect(() => {
        targetPubkey;
        cachedResult = null;
        cacheStatus = null;
        loadingCache = false;
        assertionData = null;
        assertionStatus = null;
        assertionLoading = false;
        providerStatusByKey = new Map();
        userAssertions = new Map();
        resetDealConnections();
    });

    $effect(() => {
        if (!isOpen) {
            loadingCache = false;
            cacheStatus = null;
            return;
        }

        if (!targetPubkey) return;
        $selectedProviders;
        loadCachedResult();
        loadSocialFollows();
        loadDealConnections();
        loadAssertionData();
    });
</script>

<ModalWrapper bind:isOpen title="Analysis">
    <div class="flex flex-col gap-4 pt-4">
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <span class="text-base font-semibold">In your social network</span>
                <span
                    class="badge p-2 text-white {isInSocialNetwork
                        ? 'bg-yellow-500'
                        : 'bg-red-500'}"
                >
                    {isInSocialNetwork ? 'YES' : 'NO'}
                </span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-base font-semibold">Freelance follow network</span>
                <span
                    class="badge p-2 text-white {isInFreelanceFollow
                        ? 'bg-yellow-500'
                        : 'bg-red-500'}"
                >
                    {isInFreelanceFollow ? 'YES' : 'NO'}
                </span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-base font-semibold">SatShoot web of trust</span>
                <span
                    class="badge p-2 text-white {isInSatShootWot ? 'bg-yellow-500' : 'bg-red-500'}"
                >
                    {isInSatShootWot ? 'YES' : 'NO'}
                </span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-base font-semibold">Deal connection</span>
                <span
                    class="badge p-2 text-white {isInDealConnections
                        ? 'bg-yellow-500'
                        : 'bg-red-500'}"
                >
                    {isInDealConnections ? 'YES' : 'NO'}
                </span>
            </div>
            <p class="text-xs text-black-300 dark:text-white-300">
                Deals include accepted bids and orders. We show direct deals with you or deal links
                via your partners.
            </p>
            {#if hasDirectDealConnection}
                <span class="badge w-fit px-2 py-1 text-xs text-white bg-yellow-500">
                    Direct deal with you
                </span>
            {:else if dealLinksViaPartners.size > 0}
                <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold">Deal links via your partners</span>
                        <span class="text-xs text-black-300 dark:text-white-300">
                            {dealLinksViaPartners.size} total
                        </span>
                    </div>
                    <div class="flex flex-col gap-2 max-h-40 overflow-auto">
                        {#each Array.from(dealLinksViaPartners).slice(0, 4) as pubkey}
                            <UserProfile {pubkey} />
                        {/each}
                    </div>
                </div>
            {:else}
                <span class="text-xs text-black-300 dark:text-white-300">
                    No deal overlap yet.
                </span>
            {/if}
        </div>

        <div class="border-t-[1px] border-t-black-100 dark:border-t-white-100 pt-4">
            <div class="flex items-center justify-between">
                <span class="font-semibold">Trusted assertions (NIP-85)</span>
                {#if assertionLoading}
                    <span class="text-xs text-black-300 dark:text-white-300">Loading...</span>
                {:else if assertionData}
                    <span class="text-xs text-black-300 dark:text-white-300">
                        {assertionData.providerCount} providers
                    </span>
                {/if}
            </div>

            {#if assertionLoading}
                <div class="flex items-center gap-2 text-sm text-black-300 dark:text-white-300 mt-3">
                    <ProgressRing />
                    <span>Loading trusted assertions...</span>
                </div>
            {:else if assertionStatus}
                <div class="text-sm text-black-300 dark:text-white-300 mt-3">
                    {assertionStatus}
                </div>
            {:else if assertionData}
                <p class="text-xs text-black-300 dark:text-white-300 mt-3">
                    Summary values only show when a single provider is selected for a metric.
                </p>
                <div class="mt-3">
                    <AssertionMetrics assertions={assertionData} selectedTags={summaryUserTags} />
                </div>
            {:else}
                <div class="text-sm text-black-300 dark:text-white-300 mt-3">
                    No trusted assertion data found.
                </div>
            {/if}

            {#if !assertionLoading && selectedUserTags.length > 0}
                <div class="mt-4 border-t-[1px] border-t-black-100 dark:border-t-white-100 pt-3">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold">Provider responses</span>
                        <span class="text-xs text-black-300 dark:text-white-300">Per metric</span>
                    </div>

                    <div class="flex flex-col gap-3 mt-2">
                        {#each selectedUserTags as tag}
                            {@const providers = selectedUserProvidersByTag.get(tag) ?? []}
                            <div class="flex flex-col gap-2">
                                <div class="flex items-center justify-between text-sm text-black-700 dark:text-white-200">
                                    <span class="underline underline-offset-2 dark:text-primary-300">
                                        {getTagLabel(tag)}
                                    </span>
                                    <span>{providers.length} selected</span>
                                </div>

                                <div class="flex flex-col gap-2">
                                    {#each providers as provider}
                                        {@const key = getProviderKey(provider)}
                                        {@const status = providerStatusByKey.get(key) ?? 'no_data'}
                                        {@const assertion = userAssertions.get(key)}
                                        {@const rawValue = assertion
                                            ? getAssertionValueForTag(assertion, tag)
                                            : undefined}
                                        {@const hasValue = hasDisplayValue(rawValue)}
                                        {@const availableTags = assertion
                                            ? getAssertionAvailableTags(assertion)
                                            : []}
                                        {@const tagMissing =
                                            assertion &&
                                            !hasValue &&
                                            availableTags.length > 0 &&
                                            !availableTags.includes(tag)}
                                        <div class="flex flex-col gap-1">
                                            <div class="flex items-center justify-between gap-2">
                                                <UserProfile
                                                    pubkey={provider.serviceKey}
                                                    compact
                                                    avatarSize="tiny"
                                                    avatarClasses="w-7 h-7 sm:w-8 sm:h-8"
                                                    nameScrollable
                                                    showNip05={false}
                                                    showLNAddress={false}
                                                />
                                                <span class="text-xs font-medium text-right max-w-[55%]">
                                                    {#if hasValue}
                                                        <span
                                                            class="text-emerald-600 overflow-x-auto whitespace-nowrap scrollbar-hide"
                                                        >
                                                            {formatAssertionValue(
                                                                tag,
                                                                rawValue as number | string[] | string
                                                            )}
                                                        </span>
                                                    {:else}
                                                        <span class="text-amber-600">No data</span>
                                                    {/if}
                                                </span>
                                            </div>
                                            {#if status !== 'data'}
                                                <span class="text-xs text-black-500 dark:text-white-300">
                                                    Provider may be offline or has no data for this user.
                                                </span>
                                            {/if}
                                            {#if tagMissing}
                                                <span class="text-xs">
                                                    <span class="text-amber-600">
                                                        Tag not present in provider event.
                                                    </span>
                                                    <span class="text-black-600 dark:text-white-200">
                                                        {' '}Available:
                                                    </span>
                                                    <span class="text-black-700 dark:text-primary-300">
                                                        {availableTags.join(', ')}
                                                    </span>
                                                </span>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if providerExtrasByService.size > 0}
                <details class="mt-4 border-t-[1px] border-t-black-100 dark:border-t-white-100 pt-3">
                    <summary class="cursor-pointer text-sm font-semibold text-black-600 dark:text-white-200">
                        Other provider metrics
                    </summary>
                    <div class="mt-3 flex flex-col gap-4">
                        {#each Array.from(providerExtrasByService.values()) as entry}
                            <div class="flex flex-col gap-2">
                                <UserProfile
                                    pubkey={entry.provider.serviceKey}
                                    compact
                                    avatarSize="tiny"
                                    avatarClasses="w-7 h-7 sm:w-8 sm:h-8"
                                    nameScrollable
                                    showNip05={false}
                                    showLNAddress={false}
                                />
                                <div class="flex flex-col gap-1">
                                    {#each entry.metrics as metric}
                                        {@const tag = metric[0]}
                                        {@const value = metric[1]}
                                        <div class="flex items-center justify-between gap-2">
                                            <span class="text-sm text-black-700 dark:text-primary-300 underline underline-offset-2">
                                                {getTagLabel(tag)}
                                            </span>
                                            <span
                                                class="text-sm text-black-700 dark:text-white-200 max-w-[55%] overflow-x-auto whitespace-nowrap scrollbar-hide"
                                            >
                                                {formatAssertionValue(tag, value)}
                                            </span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                </details>
            {/if}
        </div>

        <div class="border-t-[1px] border-t-black-100 dark:border-t-white-100 pt-4">
            <div class="flex items-center justify-between">
                <span class="font-semibold">Vertex analysis</span>
                {#if dataAgeText}
                    <span class="text-sm font-normal {dataAgeClass}">Data {dataAgeText}</span>
                {/if}
            </div>

            {#if loadingCache}
                <div
                    class="flex items-center gap-2 text-sm text-black-300 dark:text-white-300 mt-3"
                >
                    <ProgressRing />
                    <span>Loading cached analysis...</span>
                </div>
            {:else if cacheStatus}
                <div class="text-sm text-black-300 dark:text-white-300 mt-3">{cacheStatus}</div>
            {/if}

            {#if loading}
                <div
                    class="flex items-center gap-2 text-sm text-black-300 dark:text-white-300 mt-3"
                >
                    <ProgressRing />
                    <span>Requesting analysis from Vertex...</span>
                </div>
            {/if}

            <Button onClick={runAnalysis} disabled={loading || loadingCache} classes="mt-3">
                {cachedResult ? 'Refresh Analysis' : 'Run Analysis'}
            </Button>
        </div>

        {#if cachedResult}
            <div class="border-t-[1px] border-t-black-100 dark:border-t-white-100 pt-4">
                <div class="flex items-center justify-between">
                    <span class="font-semibold">Top social followers</span>
                    {#if loadingSocialFollows}
                        <span class="text-xs text-black-300 dark:text-white-300"
                            >Loading follows...</span
                        >
                    {:else}
                        <span class="text-xs text-black-300 dark:text-white-300"
                            >Followed on social by You?</span
                        >
                    {/if}
                </div>

                <div class="flex flex-col gap-2 mt-3">
                    {#each cachedResult.result.followers as follower}
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex flex-col gap-1">
                                <UserProfile pubkey={follower.pubkey} />
                                <span class="text-xs text-black-300 dark:text-white-300">
                                    Rank {follower.rank.toFixed(6)}
                                </span>
                            </div>
                            <span
                                class="badge px-2 py-1 text-xs text-white {socialFollows.has(
                                    follower.pubkey
                                )
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'}"
                            >
                                {socialFollows.has(follower.pubkey) ? 'FOLLOWING' : 'NOT FOLLOWING'}
                            </span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</ModalWrapper>

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }

    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
