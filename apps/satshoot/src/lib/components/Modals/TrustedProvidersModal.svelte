<script lang="ts">
    import ModalWrapper from '$lib/components/UI/ModalWrapper.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import TrustedProviderRow from '$lib/components/Modals/TrustedProviderRow.svelte';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import {
        showTrustedProvidersModal,
        availableCapabilities,
        getRankedProvidersForCapability,
        selectedProviders,
        toggleProviderSelection,
        isProviderSelected,
        saveProviderSelection,
        encryptProviderConfig,
        loadingProviders,
        wotProviderConfigs,
        providerDiscoveryState,
    } from '$lib/stores/assertions';
    import * as assertionStores from '$lib/stores/assertions';
    import type { RankedProvider, TrustedProvider } from '$lib/services/assertions/types';
    import type { Hexpubkey } from '@nostr-dev-kit/ndk';
    import { toaster } from '$lib/stores/toaster';
    import currentUser from '$lib/stores/user';
    import { NIP85_USER_ASSERTION_KIND } from '$lib/services/assertions/AssertionProviderConfig.svelte';
    import type { Writable, Readable } from 'svelte/store';

    type ProviderTagVerification = {
        tags: string[];
        updatedAt: number;
        status: 'verified' | 'no_data' | 'error';
    };

    const assertionStoresAny = assertionStores as unknown as {
        userProviderConfigLoaded: Readable<boolean>;
        providerTagVerification: Writable<Map<Hexpubkey, ProviderTagVerification>>;
        providerConfigsByKey: Readable<Map<string, TrustedProvider>>;
        verifyProviderTags: (targetPubkey: Hexpubkey, providers: TrustedProvider[]) => Promise<void>;
    };
    const providerTagVerification = assertionStoresAny.providerTagVerification;
    const providerConfigsByKey = assertionStoresAny.providerConfigsByKey;
    const verifyProviderTags = assertionStoresAny.verifyProviderTags;
    const userProviderConfigLoaded = assertionStoresAny.userProviderConfigLoaded;

    let isOpen = $state(false);
    let selectedCapability = $state<string | null>(null);
    let rankedProviders = $state<RankedProvider[]>([]);
    let isSaving = $state(false);
    let openRecommenderKey = $state<string | null>(null);
    let isVerifying = $state(false);
    let verifyError = $state<string | null>(null);
    let initialSelectedProviderKeys = $state<Set<string>>(new Set());
    let initialSelectionCaptured = $state(false);


    const encryptTooltip =
        '<div>' +
        'Encrypting hides your provider choices. ' +
        'Publishing unencrypted helps other users discover trusted providers.' +
        '</div>';

    // Bind modal state
    $effect(() => {
        isOpen = $showTrustedProvidersModal;
    });

    $effect(() => {
        if (!isOpen) {
            showTrustedProvidersModal.set(false);
            openRecommenderKey = null;
            initialSelectionCaptured = false;
            initialSelectedProviderKeys = new Set();
        }
    });

    $effect(() => {
        if (!isOpen || initialSelectionCaptured) return;
        if (!$userProviderConfigLoaded) return;

        initialSelectedProviderKeys = new Set(
            $selectedProviders.map((provider) => `${provider.serviceKey}:${provider.kindTag}`)
        );
        initialSelectionCaptured = true;
    });

    // Load providers for selected capability
    $effect(() => {
        if (selectedCapability) {
            const providers = getRankedProvidersForCapability(selectedCapability);

            if (initialSelectionCaptured && initialSelectedProviderKeys.size > 0) {
                const selectedFirst = providers.filter((provider) =>
                    initialSelectedProviderKeys.has(getProviderKey(provider))
                );
                const rest = providers.filter(
                    (provider) => !initialSelectedProviderKeys.has(getProviderKey(provider))
                );
                rankedProviders = [...selectedFirst, ...rest];
                return;
            }

            rankedProviders = providers;
        }
    });

    // Parse capability display name
    function getCapabilityDisplayName(kindTag: string): string {
        const [kind, tag] = kindTag.split(':');
        const kindNames: Record<string, string> = {
            '30382': 'User',
            '30383': 'Event',
            '30384': 'Addressable',
            '30385': 'External',
        };

        const tagNames: Record<string, string> = {
            rank: 'Rank',
            followers: 'Followers',
            zap_amt_recd: 'Zaps Received',
            zap_amt_sent: 'Zaps Sent',
            post_cnt: 'Post Count',
            comment_cnt: 'Comment Count',
            reaction_cnt: 'Reaction Count',
        };

        const kindName = kindNames[kind as string] || kind;
        const tagName = tagNames[tag as string] || tag;

        return `${kindName} - ${tagName}`;
    }

    const selectedCapabilityLabel = $derived.by(() => {
        if (!selectedCapability) return '';
        return getCapabilityDisplayName(selectedCapability);
    });

    // Check if provider is selected
    function isSelected(provider: RankedProvider): boolean {
        return $selectedProviders.some(
            (p) =>
                p.serviceKey === provider.provider.serviceKey &&
                p.kindTag === provider.provider.kindTag
        );
    }

    // Handle provider toggle
    function handleToggle(provider: RankedProvider) {
        toggleProviderSelection(provider.provider);
    }

    // Handle save
    async function handleSave() {
        isSaving = true;
        try {
            const saveConfig = saveProviderSelection as unknown as (
                providers: typeof $selectedProviders,
                encrypt: boolean
            ) => Promise<void>;

            await saveConfig($selectedProviders, $encryptProviderConfig);
            toaster.success({
                title: 'Provider configuration saved successfully',
            });
            isOpen = false;
        } catch (error) {
            console.error('Failed to save provider config:', error);
            toaster.error({
                title: 'Failed to save provider configuration',
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            isSaving = false;
        }
    }

    function getProviderKey(provider: RankedProvider): string {
        return `${provider.provider.serviceKey}:${provider.provider.kindTag}`;
    }

    function toggleRecommenders(providerKey: string) {
        openRecommenderKey = openRecommenderKey === providerKey ? null : providerKey;
    }

    const providerRecommenders = $derived.by(() => {
        const map = new Map<string, Set<Hexpubkey>>();

        $wotProviderConfigs.forEach((providers, userPubkey) => {
            providers.forEach((provider) => {
                const key = `${provider.serviceKey}:${provider.kindTag}`;
                const existing = map.get(key) ?? new Set<Hexpubkey>();
                existing.add(userPubkey);
                map.set(key, existing);
            });
        });

        return map;
    });

    function getRecommenders(provider: RankedProvider): Hexpubkey[] {
        const key = getProviderKey(provider);
        const recommenders = providerRecommenders.get(key);
        return recommenders ? Array.from(recommenders) : [];
    }

    // Get capabilities array for iteration
    $effect(() => {
        if ($availableCapabilities.size > 0 && !selectedCapability) {
            const first = Array.from($availableCapabilities)[0];
            if (first) {
                selectedCapability = first;
            }
        }
    });

    const capabilitiesArray = $derived(Array.from($availableCapabilities));
    const selectedProviderCount = $derived.by(() => {
        if (!selectedCapability) return 0;
        return $selectedProviders.filter((provider) => provider.kindTag === selectedCapability).length;
    });

    const verificationSummary = $derived.by(() => {
        let verified = 0;
        let missing = 0;
        let noData = 0;
        let error = 0;
        let unverified = 0;

        $selectedProviders.forEach((provider) => {
            if (provider.kind !== NIP85_USER_ASSERTION_KIND) return;
            const verification = $providerTagVerification.get(provider.serviceKey);

            if (!verification) {
                unverified += 1;
                return;
            }

            if (verification.status === 'error') {
                error += 1;
                return;
            }

            if (verification.status === 'no_data') {
                noData += 1;
                return;
            }

            if (!verification.tags.includes(provider.tag)) {
                missing += 1;
            } else {
                verified += 1;
            }
        });

        return { verified, missing, noData, error, unverified };
    });

    const usedCachedRelays = $derived.by(() => {
        const state = $providerDiscoveryState as { usedCachedRelays?: boolean };
        return Boolean(state.usedCachedRelays);
    });

    const discoverySteps = $derived.by(() => {
        const stepOne = usedCachedRelays
            ? '1/4: Using cached relay set...'
            : '1/4: Finding optimal relays from your Web of Trust...';

        return [
            stepOne,
            '2/4: Adding optimal relays to pool...',
            '3/4: Fetching provider configs (kind 10040)...',
            '4/4: Filtering results to your Web of Trust...',
        ];
    });

    async function handleVerifyProviders() {
        if (!$currentUser) {
            toaster.error({
                title: 'You must be logged in to verify providers',
            });
            return;
        }

        isVerifying = true;
        verifyError = null;

        try {
            await verifyProviderTags($currentUser.pubkey, $selectedProviders);
        } catch (error) {
            verifyError = error instanceof Error ? error.message : 'Verification failed';
            toaster.error({
                title: 'Provider verification failed',
                description: verifyError,
            });
        } finally {
            isVerifying = false;
        }
    }

    function handleSwitchTag(provider: RankedProvider, newTag: string) {
        if (provider.provider.kind !== NIP85_USER_ASSERTION_KIND) return;
        if (provider.provider.tag === newTag) return;
        const kindTag = `${provider.provider.kind}:${newTag}`;
        const key = `${provider.provider.serviceKey}:${kindTag}`;
        const nextProvider = $providerConfigsByKey.get(key) ?? {
            ...provider.provider,
            kindTag,
            tag: newTag,
        };

        toggleProviderSelection(provider.provider);
        if (!isProviderSelected(nextProvider.serviceKey, nextProvider.kindTag)) {
            toggleProviderSelection(nextProvider);
        }
        selectedCapability = kindTag;
    }
</script>

<ModalWrapper
    bind:isOpen
    title="Trusted Assertion Providers"
    popUpText="Select trusted providers for reputation calculations. Providers are ranked by how many people in your Web of Trust use them."
>
    <div class="flex flex-col gap-[15px] pt-[15px]">
        {#if $loadingProviders}
            <div class="flex flex-col gap-4 p-4">
                <div class="flex flex-col gap-2 w-full">
                    {#each discoverySteps as step, index}
                        <div
                            class="flex items-center gap-2 p-2 rounded {$providerDiscoveryState.step >
                            index + 1
                                ? 'text-success-500'
                                : $providerDiscoveryState.step === index + 1
                                  ? 'text-primary-500 font-semibold'
                                  : 'text-gray-400'}"
                        >
                            {#if $providerDiscoveryState.step > index + 1}
                                <i class="bx bx-check-circle text-xl"></i>
                            {:else if $providerDiscoveryState.step === index + 1}
                                <i class="bx bx-loader-circle bx-spin text-xl"></i>
                            {:else}
                                <i class="bx bx-circle text-xl"></i>
                            {/if}
                            <span>{step}</span>
                        </div>
                    {/each}
                </div>

                {#if $providerDiscoveryState.step === 1 &&
                    $providerDiscoveryState.totalUsers > 0 &&
                    !usedCachedRelays}
                    <p class="text-sm text-center text-gray-500 dark:text-gray-400">
                        Batch {$providerDiscoveryState.currentBatch}/{$providerDiscoveryState.totalBatches}
                        • Found relays for {$providerDiscoveryState.fetchedUsers}/{$providerDiscoveryState.totalUsers}
                        users
                    </p>
                {/if}

                {#if usedCachedRelays}
                    <p class="text-sm text-center text-gray-500 dark:text-gray-400">
                        Using cached relays from your last discovery session.
                    </p>
                {/if}

                {#if $providerDiscoveryState.step === 2 && $providerDiscoveryState.relayCount > 0}
                    <p class="text-sm text-center text-gray-500 dark:text-gray-400">
                        Adding {$providerDiscoveryState.relayCount} optimal relays
                    </p>
                {/if}

                {#if $providerDiscoveryState.step === 3}
                    <p class="text-sm text-center text-gray-500 dark:text-gray-400">
                        Fetched {$providerDiscoveryState.fetchedEvents} provider config events
                    </p>
                {/if}

                {#if $providerDiscoveryState.step === 4}
                    <p class="text-sm text-center text-gray-500 dark:text-gray-400">
                        {$providerDiscoveryState.filteredEvents} matching configs •
                        {$providerDiscoveryState.providerCount} providers loaded
                    </p>
                {/if}

                {#if $providerDiscoveryState.status === 'error'}
                    <p class="text-sm text-center text-red-500">
                        {$providerDiscoveryState.error ?? 'Provider discovery failed'}
                    </p>
                {/if}
            </div>
        {:else if $providerDiscoveryState.status === 'error'}
            <div class="flex flex-col items-center justify-center p-8 gap-2">
                <p class="text-red-500">Provider discovery failed.</p>
                <p class="text-sm text-gray-400">
                    {$providerDiscoveryState.error ?? 'Check your relay connections and try again.'}
                </p>
            </div>
        {:else if capabilitiesArray.length === 0}
            <div class="flex flex-col items-center justify-center p-8 gap-2">
                <p class="text-gray-500">No providers found in your Web of Trust.</p>
                <p class="text-sm text-gray-400">
                    Follow users who have configured trusted providers to see options here.
                </p>
            </div>
        {:else}
            <!-- Capability selector -->
            <div class="flex flex-col gap-[5px]">
                <label for="capability-select" class="text-sm font-medium">
                    Select Capability:
                </label>
                <div class="relative">
                    <select
                        id="capability-select"
                        bind:value={selectedCapability}
                        class="input p-2 rounded border border-black-100 dark:border-white-100 relative z-0"
                    >
                        {#each capabilitiesArray as capability}
                            <option value={capability} class="whitespace-nowrap">
                                {getCapabilityDisplayName(capability)}
                            </option>
                        {/each}
                    </select>
                    <div
                        class="pointer-events-none absolute inset-y-0 left-0 right-8 flex items-center px-2 text-black-700 dark:text-white-200 z-10"
                    >
                        <span class="block w-full overflow-x-auto whitespace-nowrap scrollbar-hide sm:max-w-[620px]">
                            {selectedCapabilityLabel}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Provider list -->
            {#if selectedCapability}
                <div class="flex flex-col gap-[10px]">
                    <div class="flex justify-between items-center">
                        <div class="font-medium flex items-center gap-3 min-w-0 pr-4">
                            <span class="shrink-0">Providers for</span>
                            <span
                                class="block max-w-[180px] sm:max-w-[320px] overflow-x-auto whitespace-nowrap scrollbar-hide"
                                title={getCapabilityDisplayName(selectedCapability)}
                            >
                                {getCapabilityDisplayName(selectedCapability)}
                            </span>
                        </div>
                        <span class="text-sm text-gray-500 shrink-0 ml-4">
                            {selectedProviderCount} selected
                        </span>
                    </div>

                    <div class="flex flex-col gap-[8px] max-h-[400px] overflow-y-auto scrollbar-hide">
                        {#each rankedProviders as provider (getProviderKey(provider))}
                            {@const providerKey = getProviderKey(provider)}
                            <TrustedProviderRow
                                {provider}
                                selected={isSelected(provider)}
                                recommenders={getRecommenders(provider)}
                                expanded={openRecommenderKey === providerKey}
                                verification={$providerTagVerification.get(
                                    provider.provider.serviceKey
                                ) ?? null}
                                onSwitchTag={(tag: string) => handleSwitchTag(provider, tag)}
                                onToggle={() => handleToggle(provider)}
                                onToggleRecommenders={() => toggleRecommenders(providerKey)}
                            />
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Summary -->
            <div
                class="flex items-center justify-between p-3 rounded bg-gray-50 dark:bg-gray-800"
            >
                <span class="text-sm font-medium">Selected providers:</span>
                <span class="text-sm font-bold">{$selectedProviders.length}</span>
            </div>

            <div class="flex items-center justify-between p-3 rounded bg-gray-50 dark:bg-gray-800">
                <div class="flex items-center gap-2">
                    <input
                        id="encrypt-provider-config"
                        type="checkbox"
                        class="appearance-none h-[18px] w-[18px] border-[1px] border-black-200 dark:border-white-200 rounded-[4px] checked:bg-blue-500 checked:border-white peer"
                        bind:checked={$encryptProviderConfig}
                    />
                    <label class="text-sm font-medium" for="encrypt-provider-config">
                        Encrypt provider config
                    </label>
                    <QuestionIcon
                        extraClasses="w-5 h-5 text-base *:pointer-events-none text-center"
                        placement="top"
                        popUpText={encryptTooltip}
                    />
                </div>
                <span class="text-xs text-gray-500">NIP-44</span>
            </div>

            <div class="flex flex-col gap-2 p-3 rounded bg-gray-50 dark:bg-gray-800">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium">Verify provider tags</span>
                    <Button
                        variant="outlined"
                        onClick={handleVerifyProviders}
                        disabled={isVerifying || $selectedProviders.length === 0}
                    >
                        {isVerifying ? 'Verifying...' : 'Verify providers'}
                    </Button>
                </div>
                <div class="text-xs text-gray-500">
                    {verificationSummary.verified} verified • {verificationSummary.missing} missing •
                    {verificationSummary.noData} no data • {verificationSummary.unverified} unverified
                </div>
                {#if verificationSummary.missing > 0}
                    <div class="text-xs text-amber-600">
                        Some selected tags are not present in provider events.
                    </div>
                {:else if verificationSummary.noData > 0}
                    <div class="text-xs text-amber-600">
                        Some providers returned no data during verification.
                    </div>
                {:else if verificationSummary.error > 0}
                    <div class="text-xs text-amber-600">
                        Some providers failed verification.
                    </div>
                {:else if verificationSummary.unverified > 0}
                    <div class="text-xs text-amber-600">
                        Some providers are unverified. Run verification to confirm tags.
                    </div>
                {/if}
                {#if verifyError}
                    <div class="text-xs text-red-500">{verifyError}</div>
                {/if}
            </div>

            <!-- Actions -->
            <div class="flex gap-[10px] justify-end pt-[10px]">
                <Button variant="outlined" onClick={() => (isOpen = false)}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={isSaving || $selectedProviders.length === 0}
                >
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </Button>
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

    #capability-select {
        color: transparent;
    }

    #capability-select option {
        color: #111827;
    }

    :global(.dark) #capability-select option {
        color: #e5e7eb;
    }
</style>
