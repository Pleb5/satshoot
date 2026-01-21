<script lang="ts">
    import { tick } from 'svelte';
    import { differenceInDays } from 'date-fns';
    import { NDKKind, NDKSubscriptionCacheUsage, type Hexpubkey } from '@nostr-dev-kit/ndk';

    import ndk from '$lib/stores/session';
    import currentUser, {
        currentUserFreelanceFollows,
        currentUserFreelanceFollowNetwork,
    } from '$lib/stores/user';
    import { allBids, allJobs, allOrders, allServices } from '$lib/stores/freelance-eventstores';
    import { networkWoTScores } from '$lib/stores/wot';
    import satShootWoT from '$lib/stores/satshoot-wot';
    import { toaster } from '$lib/stores/toaster';
    import {
        getCachedVertexReputation,
        requestVertexReputation,
        type VertexReputationCacheEntry,
    } from '$lib/services/vertex/vertex-reputation';

    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';

    interface Props {
        isOpen: boolean;
        targetPubkey: Hexpubkey;
    }

    let { isOpen = $bindable(), targetPubkey }: Props = $props();

    let cachedResult = $state<VertexReputationCacheEntry | null>(null);
    let loading = $state(false);
    let loadingCache = $state(false);
    let cacheLoaded = $state(false);
    let loadingSocialFollows = $state(false);
    let cacheStatus = $state<string | null>(null);

    let socialFollows = $state<Set<Hexpubkey>>(new Set());
    let dealLinksViaPartners = $state<Set<Hexpubkey>>(new Set());
    let dealConnectionsLoaded = $state(false);
    let hasDirectDealConnection = $state(false);

    let socialFollowsLoaded = $state(false);

    const isInSocialNetwork = $derived($networkWoTScores.has(targetPubkey));
    const isInFreelanceFollow = $derived($currentUserFreelanceFollowNetwork.has(targetPubkey));
    const isInSatShootWot = $derived(satShootWoT.includes(targetPubkey));
    const isInDealConnections = $derived(hasDirectDealConnection || dealLinksViaPartners.size > 0);

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
        toaster.error({
            title,
            description,
            duration: Infinity,
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
            cachedResult = await requestVertexReputation($ndk, targetPubkey, $currentUser.pubkey);
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
        resetDealConnections();
    });

    $effect(() => {
        if (!isOpen) {
            loadingCache = false;
            cacheStatus = null;
            return;
        }

        if (!targetPubkey) return;
        loadCachedResult();
        loadSocialFollows();
        loadDealConnections();
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
