import { writable, derived, get } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Writable, Readable } from 'svelte/store';
import ndk, {
    BLACKLISTED_RELAYS,
    discoveredRelays as sessionDiscoveredRelays,
} from './session';
import currentUser from './user';
import { getSampledWoTPubkeys } from './wot';
import type { Hexpubkey, NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import {
    AssertionProviderConfig,
    NIP85_PROVIDER_CONFIG_KIND,
    NIP85_USER_ASSERTION_KIND,
    aggregateProviderWebsiteRecommendations,
} from '$lib/services/assertions/AssertionProviderConfig.svelte';
import { AssertionService } from '$lib/services/assertions/AssertionService.svelte';
import type {
    TrustedProvider,
    ProviderInfo,
    RankedProvider,
    ProviderWebsiteRecommendation,
} from '$lib/services/assertions/types';
import { calculateRelaySet } from '$lib/utils/outboxRelays';
import { withTimeout } from '$lib/utils/helpers';
import { getMapSerializer } from '$lib/utils/misc';

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
export const userProviderConfigLoaded = writable(false);

export type ProviderDiscoveryState = {
    step: number;
    totalSteps: number;
    totalUsers: number;
    fetchedUsers: number;
    currentBatch: number;
    totalBatches: number;
    relayCount: number;
    fetchedEvents: number;
    filteredEvents: number;
    providerCount: number;
    usedCachedRelays: boolean;
    status: 'idle' | 'running' | 'done' | 'error';
    error?: string;
};

const INITIAL_PROVIDER_DISCOVERY_STATE: ProviderDiscoveryState = {
    step: 0,
    totalSteps: 4,
    totalUsers: 0,
    fetchedUsers: 0,
    currentBatch: 0,
    totalBatches: 0,
    relayCount: 0,
    fetchedEvents: 0,
    filteredEvents: 0,
    providerCount: 0,
    usedCachedRelays: false,
    status: 'idle',
};

export const providerDiscoveryState: Writable<ProviderDiscoveryState> = writable(
    INITIAL_PROVIDER_DISCOVERY_STATE
);

export type ExtraCapabilityDiscoveryState = {
    status: 'idle' | 'running' | 'done' | 'error';
    totalProviders: number;
    scannedProviders: number;
    discoveredCapabilities: number;
    errors: number;
    lastRun?: number;
    error?: string;
};

const INITIAL_EXTRA_CAPABILITY_DISCOVERY_STATE: ExtraCapabilityDiscoveryState = {
    status: 'idle',
    totalProviders: 0,
    scannedProviders: 0,
    discoveredCapabilities: 0,
    errors: 0,
};

export const extraCapabilityDiscoveryState: Writable<ExtraCapabilityDiscoveryState> = writable(
    INITIAL_EXTRA_CAPABILITY_DISCOVERY_STATE
);

export const discoveredProviderCapabilities: Writable<Map<Hexpubkey, Set<string>>> = writable(
    new Map()
);

/**
 * Modal state
 */
export const showTrustedProvidersModal = writable(false);

/**
 * Persisted encryption preference for provider config
 */
export const encryptProviderConfig: Writable<boolean> = persisted(
    'nip85EncryptProviderConfig',
    false
);

export type ProviderTagVerification = {
    tags: string[];
    updatedAt: number;
    status: 'verified' | 'no_data' | 'error';
};

export const providerTagVerification: Writable<Map<Hexpubkey, ProviderTagVerification>> =
    persisted('nip85ProviderTagVerification', new Map(), {
        serializer: getMapSerializer<Hexpubkey, ProviderTagVerification>(),
    });

export const providerConfigsByKey: Readable<Map<string, TrustedProvider>> = derived(
    [wotProviderConfigs],
    ([$wotProviderConfigs]) => {
        const map = new Map<string, TrustedProvider>();
        $wotProviderConfigs.forEach((providers) => {
            providers.forEach((provider) => {
                map.set(`${provider.serviceKey}:${provider.kindTag}`, provider);
            });
        });
        return map;
    }
);

export const providerWebsiteRecommendations: Readable<ProviderWebsiteRecommendation[]> = derived(
    [wotProviderConfigs, providerInfoMap],
    ([$wotProviderConfigs, $providerInfoMap]) =>
        aggregateProviderWebsiteRecommendations($wotProviderConfigs, $providerInfoMap)
);

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

export const discoveredCapabilities: Readable<Set<string>> = derived(
    [discoveredProviderCapabilities],
    ([$discoveredProviderCapabilities]) => {
        const capabilities = new Set<string>();
        $discoveredProviderCapabilities.forEach((tags) => {
            tags.forEach((kindTag) => capabilities.add(kindTag));
        });
        return capabilities;
    }
);

const PROVIDER_DISCOVERY_TIMEOUT_MS = 2000;
const DISCOVERY_EVENT_LIMIT = 10;

/**
 * Load provider configurations from Web of Trust
 */
export async function loadWoTProviderConfigs(): Promise<void> {
    const $ndk = get(ndk);
    const $currentUser = get(currentUser);
    const wotPubkeys = getSampledWoTPubkeys();
    const cachedRelays = get(sessionDiscoveredRelays);

    if (!$ndk || !$currentUser) {
        console.warn('Cannot load provider configs: NDK not ready or user not logged in');
        return;
    }

    loadingProviders.set(true);
    providersLoaded.set(false);
    providerDiscoveryState.set({
        ...INITIAL_PROVIDER_DISCOVERY_STATE,
        status: 'running',
        step: 1,
        totalUsers: wotPubkeys.length,
    });

    try {
        const service = new AssertionProviderConfig($ndk);
        console.log('[nip85] Loading trusted providers from WoT');

        if (wotPubkeys.length === 0) {
            wotProviderConfigs.set(new Map());
            providerInfoMap.set(new Map());
            providersLoaded.set(true);
            providerDiscoveryState.set({
                ...INITIAL_PROVIDER_DISCOVERY_STATE,
                status: 'done',
            });
            return;
        }

        let sanitizedRelays: string[] = [];
        if (cachedRelays.length > 0) {
            sanitizedRelays = cachedRelays
                .map((relay) => relay.trim())
                .filter((relay) => relay.length > 0)
                .filter((relay) => !BLACKLISTED_RELAYS.has(relay));

            providerDiscoveryState.update((state) => ({
                ...state,
                usedCachedRelays: sanitizedRelays.length > 0,
            }));

            if (sanitizedRelays.length > 0) {
                sessionDiscoveredRelays.set(sanitizedRelays.slice(0, 5));
            }
        }

        if (sanitizedRelays.length === 0) {
            const relayUrls = await calculateRelaySet(wotPubkeys, $ndk, (progress) => {
                providerDiscoveryState.update((state) => ({
                    ...state,
                    fetchedUsers: progress.fetchedUsers,
                    currentBatch: progress.currentBatch,
                    totalBatches: progress.totalBatches,
                }));
            });

            sanitizedRelays = relayUrls
                .map((relay) => relay.trim())
                .filter((relay) => relay.length > 0)
                .filter((relay) => !BLACKLISTED_RELAYS.has(relay));

            sessionDiscoveredRelays.set(sanitizedRelays.slice(0, 5));
        }

        providerDiscoveryState.update((state) => ({
            ...state,
            step: 2,
            relayCount: sanitizedRelays.length,
        }));

        for (const relayUrl of sanitizedRelays) {
            if (BLACKLISTED_RELAYS.has(relayUrl.trim())) continue;
            $ndk.addExplicitRelay(relayUrl, undefined, true);
        }

        const connectedPoolRelays = $ndk.pool?.connectedRelays?.() ?? [];
        const connectedOutboxRelays = $ndk.outboxPool?.connectedRelays?.() ?? [];
        const relaySetUrls = Array.from(
            new Set([
                ...sanitizedRelays,
                ...connectedPoolRelays.map((relay) => relay.url),
                ...connectedOutboxRelays.map((relay) => relay.url),
            ])
        );

        providerDiscoveryState.update((state) => ({
            ...state,
            step: 3,
            relayCount: relaySetUrls.length,
        }));

        const filter = { kinds: [NIP85_PROVIDER_CONFIG_KIND] };
        const options = { closeOnEose: true, groupable: false };
        const relaySet = relaySetUrls.length > 0
            ? NDKRelaySet.fromRelayUrls(relaySetUrls, $ndk)
            : undefined;

        const events = relaySet
            ? await $ndk.fetchEvents(filter, options, relaySet)
            : await $ndk.fetchEvents(filter, options);

        providerDiscoveryState.update((state) => ({
            ...state,
            fetchedEvents: events.size,
        }));

        const wotSet = new Set(wotPubkeys);
        const latestEvents = new Map<Hexpubkey, NDKEvent>();

        events.forEach((event) => {
            const author = event.pubkey as Hexpubkey;
            if (!wotSet.has(author)) return;

            const existing = latestEvents.get(author);
            const createdAt = event.created_at ?? 0;
            if (!existing || createdAt > (existing.created_at ?? 0)) {
                latestEvents.set(author, event);
            }
        });

        providerDiscoveryState.update((state) => ({
            ...state,
            step: 4,
            filteredEvents: latestEvents.size,
        }));

        const configs = new Map<Hexpubkey, TrustedProvider[]>();
        latestEvents.forEach((event, pubkey) => {
            const providers = service.parseProviderEvent(event);
            if (providers.length > 0) {
                configs.set(pubkey, providers);
            }
        });

        wotProviderConfigs.set(configs);

        // Aggregate provider usage
        const aggregated = service.aggregateProviderUsage(configs);

        try {
            const serviceKeys = Array.from(aggregated.keys());
            const metadataMap = await service.fetchProviderMetadata(serviceKeys);
            service.enrichWithMetadata(aggregated, metadataMap);
        } catch (error) {
            console.warn('Failed to enrich provider metadata:', error);
        }

        providerInfoMap.set(aggregated);
        providersLoaded.set(true);
        providerDiscoveryState.update((state) => ({
            ...state,
            providerCount: configs.size,
            status: 'done',
        }));
    } catch (error) {
        console.error('Failed to load provider configs:', error);
        providerDiscoveryState.update((state) => ({
            ...state,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        }));
    } finally {
        loadingProviders.set(false);
    }
}

/**
 * Discover extra user-assertion capabilities from providers
 */
export async function discoverExtraCapabilities(): Promise<void> {
    const $ndk = get(ndk);
    const $wotProviderConfigs = get(wotProviderConfigs);
    const currentState = get(extraCapabilityDiscoveryState);

    if (currentState.status === 'running') {
        return;
    }

    if (!$ndk) {
        extraCapabilityDiscoveryState.set({
            ...INITIAL_EXTRA_CAPABILITY_DISCOVERY_STATE,
            status: 'error',
            error: 'NDK not ready',
        });
        return;
    }

    if ($wotProviderConfigs.size === 0) {
        extraCapabilityDiscoveryState.set({
            ...INITIAL_EXTRA_CAPABILITY_DISCOVERY_STATE,
            status: 'done',
        });
        return;
    }

    const providerTargets = new Map<Hexpubkey, { relayHints: Set<string> }>();

    $wotProviderConfigs.forEach((providers) => {
        providers.forEach((provider) => {
            if (provider.kind !== NIP85_USER_ASSERTION_KIND) return;

            const relayHint = provider.relayHint?.trim();
            const existing = providerTargets.get(provider.serviceKey);
            if (!existing) {
                const relayHints = new Set<string>();
                if (relayHint) relayHints.add(relayHint);
                providerTargets.set(provider.serviceKey, { relayHints });
                return;
            }

            if (relayHint) {
                existing.relayHints.add(relayHint);
            }
        });
    });

    const totalProviders = providerTargets.size;
    if (totalProviders === 0) {
        extraCapabilityDiscoveryState.set({
            ...INITIAL_EXTRA_CAPABILITY_DISCOVERY_STATE,
            status: 'done',
        });
        return;
    }

    const discovered = new Map(get(discoveredProviderCapabilities));
    extraCapabilityDiscoveryState.set({
        status: 'running',
        totalProviders,
        scannedProviders: 0,
        discoveredCapabilities: countDiscoveredCapabilities(discovered),
        errors: 0,
        lastRun: Date.now(),
    });

    let scanned = 0;
    let errors = 0;

    try {
        const service = new AssertionService($ndk);
        const $providerInfoMap = get(providerInfoMap);

        for (const [serviceKey, entry] of providerTargets) {
            try {
                const relayHints = Array.from(entry.relayHints);
                const summary = await withTimeout(
                    service.fetchRecentUserAssertionTagSummaryForProvider(
                        serviceKey,
                        relayHints,
                        DISCOVERY_EVENT_LIMIT
                    ),
                    PROVIDER_DISCOVERY_TIMEOUT_MS,
                    `Provider tag discovery (${serviceKey})`
                );

                if (!summary) {
                    errors += 1;
                    continue;
                }

                if (summary.tags.size > 0) {
                    const existing = discovered.get(serviceKey) ?? new Set<string>();
                    summary.tags.forEach((tag) => existing.add(`${NIP85_USER_ASSERTION_KIND}:${tag}`));
                    discovered.set(serviceKey, existing);
                }

                const recommendedTagSet = new Set<string>();
                const providerInfo = $providerInfoMap.get(serviceKey);
                if (providerInfo) {
                    providerInfo.capabilities.forEach((_, kindTag) => {
                        if (!kindTag.startsWith(`${NIP85_USER_ASSERTION_KIND}:`)) return;
                        const [, tag] = kindTag.split(':');
                        if (tag) recommendedTagSet.add(tag);
                    });
                }

                const eventStatuses = summary.events.map((event) => {
                    const tagStatus = event.tagNames.map((tag) => ({
                        tag,
                        status: recommendedTagSet.has(tag) ? 'recommended' : 'new',
                    }));
                    return {
                        id: event.id,
                        created_at: event.created_at,
                        newTags: tagStatus.filter((item) => item.status === 'new').map((item) => item.tag),
                        recommendedTagsSeen: tagStatus
                            .filter((item) => item.status === 'recommended')
                            .map((item) => item.tag),
                        tagStatus,
                    };
                });

                const summaryTagStatus = Array.from(summary.tags).map((tag) => ({
                    tag,
                    status: recommendedTagSet.has(tag) ? 'recommended' : 'new',
                }));

                console.warn('[nip85] discovery tag status', {
                    provider: serviceKey,
                    relayHints,
                    recommendedTags: Array.from(recommendedTagSet),
                    summaryTags: Array.from(summary.tags),
                    summaryTagStatus,
                    events: eventStatuses,
                });
            } catch (error) {
                errors += 1;
                console.warn('Failed to discover tags from provider:', error);
            }

            scanned += 1;
            extraCapabilityDiscoveryState.update((state) => ({
                ...state,
                scannedProviders: scanned,
                discoveredCapabilities: countDiscoveredCapabilities(discovered),
                errors,
            }));
        }

        discoveredProviderCapabilities.set(discovered);
        extraCapabilityDiscoveryState.set({
            status: 'done',
            totalProviders,
            scannedProviders: scanned,
            discoveredCapabilities: countDiscoveredCapabilities(discovered),
            errors,
            lastRun: Date.now(),
        });
    } catch (error) {
        extraCapabilityDiscoveryState.set({
            status: 'error',
            totalProviders,
            scannedProviders: scanned,
            discoveredCapabilities: countDiscoveredCapabilities(discovered),
            errors: errors + 1,
            lastRun: Date.now(),
            error: error instanceof Error ? error.message : 'Discovery failed',
        });
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
        userProviderConfigLoaded.set(false);
        return;
    }

    userProviderConfigLoaded.set(false);

    try {
        const service = new AssertionProviderConfig($ndk);
        const providers = await service.getUserProviderConfig($currentUser.pubkey);
        selectedProviders.set(providers);
    } catch (error) {
        console.error('Failed to load user provider config:', error);
    } finally {
        userProviderConfigLoaded.set(true);
    }
}

/**
 * Save user's provider selection
 */
export async function saveProviderSelection(
    providers: TrustedProvider[],
    encrypt = false
): Promise<void> {
    const $ndk = get(ndk);

    if (!$ndk) {
        throw new Error('NDK not ready');
    }

    const service = new AssertionProviderConfig($ndk);
    await service.saveProviderConfig(providers, encrypt);

    // Update local state
    selectedProviders.set(providers);
}

function getLatestEvent(events: Set<NDKEvent>): NDKEvent | null {
    let latestEvent: NDKEvent | null = null;

    events.forEach((event) => {
        const createdAt = event.created_at ?? 0;
        if (!latestEvent || createdAt > (latestEvent.created_at ?? 0)) {
            latestEvent = event;
        }
    });

    return latestEvent;
}

function extractAssertionTags(event: NDKEvent): string[] {
    const tags = new Set<string>();

    event.tags.forEach((tag) => {
        const [name, value] = tag;
        if (!name || name === 'd') return;
        if (value === undefined) return;
        tags.add(name);
    });

    return Array.from(tags);
}

function countDiscoveredCapabilities(
    discovered: Map<Hexpubkey, Set<string>>
): number {
    const capabilities = new Set<string>();
    discovered.forEach((tags) => {
        tags.forEach((kindTag) => capabilities.add(kindTag));
    });
    return capabilities.size;
}

export async function verifyProviderTags(
    targetPubkey: Hexpubkey,
    providers: TrustedProvider[]
): Promise<void> {
    const $ndk = get(ndk);

    if (!$ndk) {
        throw new Error('NDK not ready');
    }

    const userProviders = providers.filter((provider) => provider.kind === NIP85_USER_ASSERTION_KIND);
    if (userProviders.length === 0) {
        return;
    }

    const providersByServiceKey = new Map<Hexpubkey, TrustedProvider>();
    userProviders.forEach((provider) => {
        if (!providersByServiceKey.has(provider.serviceKey)) {
            providersByServiceKey.set(provider.serviceKey, provider);
        }
    });

    const updatedVerification = new Map(get(providerTagVerification));

    for (const [serviceKey, provider] of providersByServiceKey) {
        try {
            const relayHint = provider.relayHint?.trim();
            const relaySet = relayHint
                ? NDKRelaySet.fromRelayUrls([relayHint], $ndk)
                : undefined;
            const filter = {
                kinds: [NIP85_USER_ASSERTION_KIND],
                authors: [serviceKey],
                '#d': [targetPubkey],
            };

            const events = relaySet
                ? await $ndk.fetchEvents(filter, { closeOnEose: true, groupable: false }, relaySet)
                : await $ndk.fetchEvents(filter, { closeOnEose: true, groupable: false });

            const latestEvent = getLatestEvent(events);
            if (!latestEvent) {
                updatedVerification.set(serviceKey, {
                    tags: [],
                    updatedAt: Date.now(),
                    status: 'no_data',
                });
                continue;
            }

            const tags = extractAssertionTags(latestEvent);
            updatedVerification.set(serviceKey, {
                tags,
                updatedAt: Date.now(),
                status: 'verified',
            });
        } catch (error) {
            console.warn('Failed to verify provider tags:', error);
            updatedVerification.set(serviceKey, {
                tags: [],
                updatedAt: Date.now(),
                status: 'error',
            });
        }
    }

    providerTagVerification.set(updatedVerification);
}


/**
 * Get ranked providers for a specific kind:tag
 */
export function getProvidersForCapability(kindTag: string): RankedProvider[] {
    const $providerInfoMap = get(providerInfoMap);
    const $discoveredProviderCapabilities = get(discoveredProviderCapabilities);
    const service = new AssertionProviderConfig(get(ndk));
    const ranked = service.getRankedProvidersForKindTag(kindTag, $providerInfoMap);
    const existingServiceKeys = new Set(ranked.map((entry) => entry.provider.serviceKey));

    const [kind, tag] = kindTag.split(':');
    const kindValue = Number.parseInt(kind, 10);
    if (!Number.isNaN(kindValue) && tag) {
        $discoveredProviderCapabilities.forEach((capabilities, serviceKey) => {
            if (!capabilities.has(kindTag)) return;
            if (existingServiceKeys.has(serviceKey)) return;

            const info = $providerInfoMap.get(serviceKey);
            if (!info) return;

            ranked.push({
                provider: {
                    kindTag,
                    serviceKey,
                    relayHint: info.relayHint,
                    kind: kindValue,
                    tag,
                },
                usageCount: 0,
                name: info.name,
                about: info.about,
                picture: info.picture,
                website: info.website,
            });
        });
    }

    ranked.sort((a, b) => {
        if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
        const aLabel = a.name ?? a.provider.serviceKey;
        const bLabel = b.name ?? b.provider.serviceKey;
        return aLabel.localeCompare(bLabel);
    });

    return ranked;
}

/**
 * Backwards-compatible helper
 */
export function getRankedProvidersForCapability(kindTag: string): RankedProvider[] {
    return getProvidersForCapability(kindTag);
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
