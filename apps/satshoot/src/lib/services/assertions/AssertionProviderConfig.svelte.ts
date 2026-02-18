import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, NDKKind, type Hexpubkey, type NDKFilter } from '@nostr-dev-kit/ndk';
import type { TrustedProvider, ProviderInfo, RankedProvider } from './types';

/**
 * NIP-85 Kind for Provider Configuration
 */
export const NIP85_PROVIDER_CONFIG_KIND = 10040;

/**
 * NIP-85 Assertion Event Kinds
 */
export const NIP85_USER_ASSERTION_KIND = 30382;
export const NIP85_EVENT_ASSERTION_KIND = 30383;
export const NIP85_ADDRESSABLE_ASSERTION_KIND = 30384;
export const NIP85_EXTERNAL_ASSERTION_KIND = 30385;

/**
 * Service to manage NIP-85 Trusted Assertion Provider configurations
 */
export class AssertionProviderConfig {
    private ndk: NDK;

    constructor(ndk: NDK) {
        this.ndk = ndk;
    }

    /**
     * Parse a kind 10040 event to extract provider configurations
     */
    parseProviderEvent(event: NDKEvent): TrustedProvider[] {
        const providers: TrustedProvider[] = [];

        event.tags.forEach((tag) => {
            if (tag.length < 3) return;

            const [kindTag, serviceKey, relayHint] = tag;
            if (!kindTag || !serviceKey || !relayHint) return;

            // Parse kind:tag format
            const parts = kindTag.split(':');
            if (parts.length !== 2) return;

            const kind = parseInt(parts[0] as string);
            const tagName = parts[1] as string;

            if (isNaN(kind)) return;

            providers.push({
                kindTag,
                serviceKey: serviceKey as Hexpubkey,
                relayHint,
                kind,
                tag: tagName,
            });
        });

        return providers;
    }

    /**
     * Fetch kind 10040 events from a set of pubkeys
     */
    async fetchProviderConfigs(pubkeys: Hexpubkey[]): Promise<Map<Hexpubkey, TrustedProvider[]>> {
        if (pubkeys.length === 0) return new Map();

        const filter: NDKFilter = {
            kinds: [NIP85_PROVIDER_CONFIG_KIND as NDKKind],
            authors: pubkeys,
        };

        const events = await this.ndk.fetchEvents(filter, {
            closeOnEose: true,
            groupable: false,
        });

        const configMap = new Map<Hexpubkey, TrustedProvider[]>();

        events.forEach((event) => {
            const providers = this.parseProviderEvent(event);
            if (providers.length > 0) {
                configMap.set(event.pubkey, providers);
            }
        });

        return configMap;
    }

    /**
     * Aggregate provider usage across WoT
     * Returns a map of serviceKey -> ProviderInfo with usage counts
     */
    aggregateProviderUsage(
        providerConfigs: Map<Hexpubkey, TrustedProvider[]>
    ): Map<Hexpubkey, ProviderInfo> {
        const providerMap = new Map<Hexpubkey, ProviderInfo>();

        providerConfigs.forEach((providers) => {
            providers.forEach((provider) => {
                let info = providerMap.get(provider.serviceKey);

                if (!info) {
                    info = {
                        serviceKey: provider.serviceKey,
                        relayHint: provider.relayHint,
                        capabilities: new Map(),
                        totalUsageCount: 0,
                    };
                    providerMap.set(provider.serviceKey, info);
                }

                // Increment usage count for this specific capability
                const currentCount = info.capabilities.get(provider.kindTag) || 0;
                info.capabilities.set(provider.kindTag, currentCount + 1);
                info.totalUsageCount++;
            });
        });

        return providerMap;
    }

    /**
     * Fetch provider metadata (kind 0) for service keys
     */
    async fetchProviderMetadata(
        serviceKeys: Hexpubkey[]
    ): Promise<Map<Hexpubkey, NDKEvent>> {
        if (serviceKeys.length === 0) return new Map();

        const filter: NDKFilter = {
            kinds: [NDKKind.Metadata],
            authors: serviceKeys,
        };

        const events = await this.ndk.fetchEvents(filter, {
            closeOnEose: true,
            groupable: true,
        });

        const metadataMap = new Map<Hexpubkey, NDKEvent>();

        events.forEach((event) => {
            const existing = metadataMap.get(event.pubkey);
            if (!existing || event.created_at! > existing.created_at!) {
                metadataMap.set(event.pubkey, event);
            }
        });

        return metadataMap;
    }

    /**
     * Enrich provider info with metadata
     */
    enrichWithMetadata(
        providerInfoMap: Map<Hexpubkey, ProviderInfo>,
        metadataMap: Map<Hexpubkey, NDKEvent>
    ): void {
        providerInfoMap.forEach((info, serviceKey) => {
            const metadata = metadataMap.get(serviceKey);
            if (!metadata) return;

            try {
                const profile = JSON.parse(metadata.content);
                info.name = profile.name;
                info.about = profile.about;
                info.picture = profile.picture;
                info.website = profile.website;
            } catch (e) {
                console.warn('Failed to parse provider metadata', e);
            }
        });
    }

    /**
     * Get ranked providers for a specific kind:tag combination
     */
    getRankedProvidersForKindTag(
        kindTag: string,
        providerInfoMap: Map<Hexpubkey, ProviderInfo>
    ): RankedProvider[] {
        const ranked: RankedProvider[] = [];

        providerInfoMap.forEach((info) => {
            const usageCount = info.capabilities.get(kindTag);
            if (!usageCount) return;

            // Find the relay hint for this specific capability
            let relayHint = info.relayHint;

            const [kind, tag] = kindTag.split(':');

            ranked.push({
                provider: {
                    kindTag,
                    serviceKey: info.serviceKey,
                    relayHint,
                    kind: parseInt(kind as string),
                    tag: tag as string,
                },
                usageCount,
                name: info.name,
                about: info.about,
                picture: info.picture,
                website: info.website,
            });
        });

        // Sort by usage count descending
        ranked.sort((a, b) => b.usageCount - a.usageCount);

        return ranked;
    }

    /**
     * Get all unique kind:tag combinations from WoT
     */
    getAvailableCapabilities(
        providerInfoMap: Map<Hexpubkey, ProviderInfo>
    ): Set<string> {
        const capabilities = new Set<string>();

        providerInfoMap.forEach((info) => {
            info.capabilities.forEach((_, kindTag) => {
                capabilities.add(kindTag);
            });
        });

        return capabilities;
    }

    /**
     * Save user's provider configuration (kind 10040)
     */
    async saveProviderConfig(
        providers: TrustedProvider[],
        encrypt = false
    ): Promise<NDKEvent> {
        const event = new NDKEvent(this.ndk);
        event.kind = NIP85_PROVIDER_CONFIG_KIND as NDKKind;

        if (encrypt) {
            // TODO: Implement NIP-44 encryption
            // For now, throw an error
            throw new Error('Encrypted provider config not yet implemented');
        } else {
            // Public tags
            event.tags = providers.map((p) => [p.kindTag, p.serviceKey, p.relayHint]);
        }

        event.content = '';

        await event.publish();

        return event;
    }

    /**
     * Get user's current provider configuration
     */
    async getUserProviderConfig(pubkey: Hexpubkey): Promise<TrustedProvider[]> {
        const filter: NDKFilter = {
            kinds: [NIP85_PROVIDER_CONFIG_KIND as NDKKind],
            authors: [pubkey],
            limit: 1,
        };

        const events = await this.ndk.fetchEvents(filter, {
            closeOnEose: true,
            groupable: false,
        });

        if (events.size === 0) return [];

        const event = Array.from(events)[0];
        return this.parseProviderEvent(event as NDKEvent);
    }
}
