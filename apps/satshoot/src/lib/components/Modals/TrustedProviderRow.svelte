<script lang="ts">
    import UserProfile from '$lib/components/UI/Display/UserProfile.svelte';
    import type { RankedProvider } from '$lib/services/assertions/types';
    import type { Hexpubkey, NDKUserProfile } from '@nostr-dev-kit/ndk';

    type ProviderTagVerification = {
        tags: string[];
        updatedAt: number;
        status: 'verified' | 'no_data' | 'error';
    };

    interface Props {
        provider: RankedProvider;
        selected: boolean;
        recommenders: Hexpubkey[];
        expanded: boolean;
        verification?: ProviderTagVerification | null;
        onSwitchTag?: (tag: string) => void;
        onToggle: () => void;
        onToggleRecommenders: () => void;
    }

    let {
        provider,
        selected,
        recommenders,
        expanded,
        verification = null,
        onSwitchTag,
        onToggle,
        onToggleRecommenders,
    }: Props = $props();


    let userProfile = $state<NDKUserProfile | null>(null);

    const providerAbout = $derived(userProfile?.about ?? '');
    const providerWebsite = $derived(userProfile?.website);
    const availableTags = $derived(verification?.tags ?? []);
    const verificationStatus = $derived.by(() => {
        if (!selected) return null;
        if (!verification) return 'unverified';
        if (verification.status === 'error') return 'error';
        if (verification.status === 'no_data') return 'no_data';
        if (!availableTags.includes(provider.provider.tag)) return 'missing';
        return 'verified';
    });

    const MAX_ABOUT_LENGTH = 200;
    let aboutExpanded = $state(false);
    const aboutNeedsTruncate = $derived(
        providerAbout.length > MAX_ABOUT_LENGTH
    );
    const aboutText = $derived.by(() => {
        if (!providerAbout) return '';
        if (!aboutNeedsTruncate || aboutExpanded) return providerAbout;
        return `${providerAbout.slice(0, MAX_ABOUT_LENGTH).trim()}...`;
    });
</script>

<div
    class="flex items-start gap-3 p-3 rounded border transition-colors {selected
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
        : 'border-black-100 dark:border-white-100 hover:border-primary-300'}"
>
    <input
        type="checkbox"
        checked={selected}
        onchange={onToggle}
        class="mt-1"
    />

    <div class="flex-1 flex flex-col gap-2 min-w-0">
        <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
                <UserProfile
                    pubkey={provider.provider.serviceKey}
                    bind:userProfile
                    compact
                    avatarSize="tiny"
                    avatarClasses="w-8 h-8 sm:w-10 sm:h-10"
                    nameScrollable
                    showNip05={false}
                    showLNAddress={false}
                />
            </div>
            <button
                type="button"
                class="px-2 py-0.5 text-xs rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
                onclick={onToggleRecommenders}
            >
                {recommenders.length} {recommenders.length === 1 ? 'user' : 'users'}
            </button>
        </div>

        {#if expanded}
            <div
                class="mt-2 w-full rounded border border-black-100 dark:border-white-100 bg-white dark:bg-brightGray p-3 shadow-subtle"
            >
                <div
                    class="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300"
                >
                    <span>Recommended by</span>
                    <span>{recommenders.length}</span>
                </div>
                {#if recommenders.length > 0}
                    <div class="mt-2 flex flex-col gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {#each recommenders as recommender}
                            <UserProfile
                                pubkey={recommender}
                                compact
                                avatarSize="tiny"
                                avatarClasses="w-8 h-8 sm:w-10 sm:h-10"
                                nameScrollable
                                showNip05={false}
                                showLNAddress={false}
                            />
                        {/each}
                    </div>
                {:else}
                    <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        No recommenders found.
                    </div>
                {/if}
            </div>
        {/if}

        {#if selected && verificationStatus === 'missing'}
            <div class="text-xs">
                <span class="text-amber-600">Tag not present.</span>
                <span class="text-black-600 dark:text-white-200"> Available:</span>
                {#if availableTags.length > 0}
                    <div class="flex flex-wrap gap-2 mt-1">
                        {#each availableTags as tag}
                            <button
                                type="button"
                                class="underline text-black-700 dark:text-white-200"
                                onclick={() => onSwitchTag?.(tag)}
                            >
                                {tag}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {:else if selected && verificationStatus === 'no_data'}
            <div class="text-xs text-amber-600">
                No data returned during verification.
            </div>
        {:else if selected && verificationStatus === 'error'}
            <div class="text-xs text-amber-600">
                Verification failed. Try again.
            </div>
        {:else if selected && verificationStatus === 'unverified'}
            <div class="text-xs text-amber-600">
                Unverified - run verification to confirm available tags.
            </div>
        {:else if selected && verificationStatus === 'verified'}
            <div class="text-xs text-emerald-600">Verified</div>
        {/if}

        {#if providerAbout}
            <div class="flex flex-col gap-1">
                <p class="text-sm text-gray-700 dark:text-gray-200 leading-snug">
                    {aboutText}
                </p>
                {#if aboutNeedsTruncate}
                    <button
                        type="button"
                        class="text-xs text-primary-600 dark:text-primary-300 underline w-fit"
                        onclick={() => (aboutExpanded = !aboutExpanded)}
                    >
                        {aboutExpanded ? 'Show less' : 'Show more'}
                    </button>
                {/if}
            </div>
        {/if}

        {#if providerWebsite}
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-500 dark:text-gray-400">Website</span>
                <a
                    href={providerWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={providerWebsite}
                    class="text-sm text-primary-600 dark:text-primary-300 hover:underline max-w-[220px] overflow-x-auto whitespace-nowrap scrollbar-hide"
                >
                    {providerWebsite}
                </a>
            </div>
        {/if}
    </div>
</div>

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }

    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
