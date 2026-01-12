<script lang="ts">
    import { tick } from 'svelte';
    import { differenceInDays } from 'date-fns';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type Hexpubkey,
    } from '@nostr-dev-kit/ndk';
    import type NDK from '@nostr-dev-kit/ndk';

    import ndk from '$lib/stores/session';
    import currentUser, { currentUserFreelanceFollows } from '$lib/stores/user';
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

    let socialFollowsLoaded = $state(false);

    const isInSocialNetwork = $derived($networkWoTScores.has(targetPubkey));
    const isInFreelanceFollow = $derived($currentUserFreelanceFollows.has(targetPubkey));
    const isInSatShootWot = $derived(satShootWoT.includes(targetPubkey));

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

    const runAnalysis = async () => {
        if (!$currentUser) {
            showErrorToast('Sign in to run analysis.');
            return;
        }

        loading = true;
        await tick();

        try {
            cachedResult = await requestVertexReputation(
                $ndk,
                targetPubkey,
                $currentUser.pubkey
            );
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
    });

    $effect(() => {
        targetPubkey;
        cachedResult = null;
        cacheStatus = null;
        loadingCache = false;
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
    });
</script>

<ModalWrapper bind:isOpen title="Analysis">
    <div class="flex flex-col gap-4 pt-4">
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <span class="text-base font-semibold">In your social network</span>
                <span
                    class="badge p-2 text-white {isInSocialNetwork ? 'bg-yellow-500' : 'bg-red-500'}"
                >
                    {isInSocialNetwork ? 'YES' : 'NO'}
                </span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-base font-semibold">Freelance follow</span>
                <span
                    class="badge p-2 text-white {isInFreelanceFollow ? 'bg-yellow-500' : 'bg-red-500'}"
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
        </div>

        <div class="border-t-[1px] border-t-black-100 dark:border-t-white-100 pt-4">
            <div class="flex items-center justify-between">
                <span class="font-semibold">Vertex analysis</span>
                {#if dataAgeText}
                    <span class="text-sm font-normal {dataAgeClass}">Data {dataAgeText}</span>
                {/if}
            </div>

            {#if loadingCache}
                <div class="flex items-center gap-2 text-sm text-black-300 dark:text-white-300 mt-3">
                    <ProgressRing />
                    <span>Loading cached analysis...</span>
                </div>
            {:else if cacheStatus}
                <div class="text-sm text-black-300 dark:text-white-300 mt-3">{cacheStatus}</div>
            {/if}

            {#if loading}
                <div class="flex items-center gap-2 text-sm text-black-300 dark:text-white-300 mt-3">
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
                    <span class="font-semibold">Top reputable followers</span>
                    {#if loadingSocialFollows}
                        <span class="text-xs text-black-300 dark:text-white-300">Loading follows...</span>
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
