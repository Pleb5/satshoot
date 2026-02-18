import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import ndk from './session';
import currentUser from './user';
import { wot } from './wot';
import type { Hexpubkey } from '@nostr-dev-kit/ndk';
import { AssertionProviderConfig } from '$lib/services/assertions/AssertionProviderConfig.svelte';
import type { TrustedProvider, ProviderInfo, RankedProvider } from '$lib/services/assertions/types';

/**
 * Store for the user's selected trusted providers
 */
export const selectedProviders: Writable<TrustedProvider[]> = writable([]);

/**
 * Store for provider configurations from WoT
 */
export const wotProviderConfigs: Writable<Map<Hexpubkey, TrustedProvider[]>> = writable(
    new Map()
);

/**
 * Store for aggregated provider info
 */
export const providerInfoMap: Writable<Map<Hexpubkey, ProviderInfo>> = writable(new Map());

/**
 * Loading states
 */
export const loadingProviders = writable(false);
export const providersLoaded = writable(false);

/**
 * Modal state
 */
export const showTrustedProvidersModal = writable(false);

/**
 * Available capabilities derived from WoT provider configs
 */
export const availableCapabilities: Readable<Set<string>> = derived(
    [providerInfoMap],
    ([$providerInfoMap]) => {
        const capabilities = new Set<string>();
        $providerInfoMap.forEach((info) => {
            info.capabilities.forEach((_, kindTag) => {
                capabilities.add(kindTag);
            });
        });
        return capabilities;
    }
);

/**
 * Load provider configurations from WoT
 */
export async function loadWoTProviderConfigs(): Promise<void> {
    const $ndk = get(ndk);
    const $wot = get(wot);

    if (!$ndk || $wot.size === 0) {
        console.warn('Cannot load provider configs: NDK not ready or WoT is empty');
        return;
    }

    loadingProviders.set(true);

    try {
        const service = new AssertionProviderConfig($ndk);

        // Fetch provider configs from WoT
        const wotPubkeys = Array.from($wot);
        const configs = await service.fetchProviderConfigs(wotPubkeys);

        wotProviderConfigs.set(configs);

        // Aggregate provider usage
        const aggregated = service.aggregateProviderUsage(configs);

        // Fetch provider metadata
        const serviceKeys = Array.from(aggregated.keys());
        const metadata = await service.fetchProviderMetadata(serviceKeys);

        // Enrich with metadata
        service.enrichWithMetadata(aggregated, metadata);

        providerInfoMap.set(aggregated);
        providersLoaded.set(true);
    } catch (error) {
        console.error('Failed to load provider configs:', error);
    } finally {
        loadingProviders.set(false);
    }
}

/**
 * Load user's selected providers
 */
export async function loadUserProviderConfig(): Promise<void> {
    const $ndk = get(ndk);
    const $currentUser = get(currentUser);

    if (!$ndk || !$currentUser) {
        console.warn('Cannot load user provider config: Not logged in');
        return;
    }

    try {
        const service = new AssertionProviderConfig($ndk);
        const providers = await service.getUserProviderConfig($currentUser.pubkey);
        selectedProviders.set(providers);
    } catch (error) {
        console.error('Failed to load user provider config:', error);
    }
}

/**
 * Save user's provider selection
 */
export async function saveProviderSelection(providers: TrustedProvider[]): Promise<void> {
    const $ndk = get(ndk);

    if (!$ndk) {
        throw new Error('NDK not ready');
    }

    const service = new AssertionProviderConfig($ndk);
    await service.saveProviderConfig(providers, false);

    // Update local state
    selectedProviders.set(providers);
}

/**
 * Get ranked providers for a specific kind:tag
 */
export function getRankedProvidersForCapability(kindTag: string): RankedProvider[] {
    const $providerInfoMap = get(providerInfoMap);
    const service = new AssertionProviderConfig(get(ndk));
    return service.getRankedProvidersForKindTag(kindTag, $providerInfoMap);
}

/**
 * Check if a provider is selected
 */
export function isProviderSelected(serviceKey: Hexpubkey, kindTag: string): boolean {
    const $selectedProviders = get(selectedProviders);
    return $selectedProviders.some(
        (p) => p.serviceKey === serviceKey && p.kindTag === kindTag
    );
}

/**
 * Toggle provider selection
 */
export function toggleProviderSelection(provider: TrustedProvider): void {
    const $selectedProviders = get(selectedProviders);

    const index = $selectedProviders.findIndex(
        (p) => p.serviceKey === provider.serviceKey && p.kindTag === provider.kindTag
    );

    if (index >= 0) {
        // Remove if already selected
        selectedProviders.set($selectedProviders.filter((_, i) => i !== index));
    } else {
        // Add if not selected
        selectedProviders.set([...$selectedProviders, provider]);
    }
}

/**
 * Clear all selections for a specific kind:tag
 */
export function clearSelectionsForCapability(kindTag: string): void {
    const $selectedProviders = get(selectedProviders);
    selectedProviders.set($selectedProviders.filter((p) => p.kindTag !== kindTag));
}

/**
 * Get selected providers for a specific kind:tag
 */
export function getSelectedProvidersForCapability(kindTag: string): TrustedProvider[] {
    const $selectedProviders = get(selectedProviders);
    return $selectedProviders.filter((p) => p.kindTag === kindTag);
}
