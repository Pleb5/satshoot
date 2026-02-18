<script lang="ts">
    import ModalWrapper from '$lib/components/UI/ModalWrapper.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import {
        showTrustedProvidersModal,
        availableCapabilities,
        getRankedProvidersForCapability,
        selectedProviders,
        toggleProviderSelection,
        saveProviderSelection,
        loadingProviders,
    } from '$lib/stores/assertions';
    import type { RankedProvider } from '$lib/services/assertions/types';
    import { toaster } from '$lib/stores/toaster';

    let isOpen = $state(false);
    let selectedCapability = $state<string | null>(null);
    let rankedProviders = $state<RankedProvider[]>([]);
    let isSaving = $state(false);

    // Bind modal state
    $effect(() => {
        isOpen = $showTrustedProvidersModal;
    });

    $effect(() => {
        if (!isOpen) {
            showTrustedProvidersModal.set(false);
        }
    });

    // Load providers for selected capability
    $effect(() => {
        if (selectedCapability) {
            rankedProviders = getRankedProvidersForCapability(selectedCapability);
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
            await saveProviderSelection($selectedProviders);
            toaster.success('Provider configuration saved successfully');
            isOpen = false;
        } catch (error) {
            console.error('Failed to save provider config:', error);
            toaster.error('Failed to save provider configuration');
        } finally {
            isSaving = false;
        }
    }

    // Format pubkey for display
    function formatPubkey(pubkey: string): string {
        return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
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
</script>

<ModalWrapper
    bind:isOpen
    title="Trusted Assertion Providers"
    popUpText="Select trusted providers for reputation calculations. Providers are ranked by how many people in your Web of Trust use them."
>
    <div class="flex flex-col gap-[15px] pt-[15px]">
        {#if $loadingProviders}
            <div class="flex items-center justify-center p-8">
                <p class="text-gray-500">Loading providers from your Web of Trust...</p>
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
                <select
                    id="capability-select"
                    bind:value={selectedCapability}
                    class="input p-2 rounded border border-black-100 dark:border-white-100"
                >
                    {#each capabilitiesArray as capability}
                        <option value={capability}>
                            {getCapabilityDisplayName(capability)}
                        </option>
                    {/each}
                </select>
            </div>

            <!-- Provider list -->
            {#if selectedCapability}
                <div class="flex flex-col gap-[10px]">
                    <div class="flex justify-between items-center">
                        <h3 class="font-medium">
                            Providers for {getCapabilityDisplayName(selectedCapability)}
                        </h3>
                        <span class="text-sm text-gray-500">
                            {rankedProviders.length} available
                        </span>
                    </div>

                    <div class="flex flex-col gap-[8px] max-h-[400px] overflow-y-auto">
                        {#each rankedProviders as provider}
                            {@const selected = isSelected(provider)}
                            <div
                                class="flex items-start gap-3 p-3 rounded border transition-colors {selected
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-black-100 dark:border-white-100 hover:border-primary-300'}"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    onchange={() => handleToggle(provider)}
                                    class="mt-1"
                                />

                                <div class="flex-1 flex flex-col gap-1">
                                    <div class="flex items-center gap-2">
                                        {#if provider.picture}
                                            <img
                                                src={provider.picture}
                                                alt={provider.name || 'Provider'}
                                                class="w-6 h-6 rounded-full"
                                            />
                                        {/if}
                                        <span class="font-medium">
                                            {provider.name || formatPubkey(provider.provider.serviceKey)}
                                        </span>
                                        <span
                                            class="px-2 py-0.5 text-xs rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
                                        >
                                            {provider.usageCount} {provider.usageCount === 1
                                                ? 'user'
                                                : 'users'}
                                        </span>
                                    </div>

                                    {#if provider.about}
                                        <p class="text-sm text-gray-600 dark:text-gray-400">
                                            {provider.about}
                                        </p>
                                    {/if}

                                    {#if provider.website}
                                        <a
                                            href={provider.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                        >
                                            {provider.website}
                                        </a>
                                    {/if}

                                    <div class="text-xs text-gray-500 font-mono">
                                        {formatPubkey(provider.provider.serviceKey)}
                                    </div>
                                </div>
                            </div>
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
