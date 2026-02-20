import type NDK from '@nostr-dev-kit/ndk';
import {
    NDKEvent,
    NDKKind,
    NDKRelaySet,
    type Hexpubkey,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';
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

    private buildRelaySet(): NDKRelaySet | undefined {
        const relayUrls: string[] = [];

        if (this.ndk.pool) {
            relayUrls.push(...this.ndk.pool.urls());
        }

        if (this.ndk.outboxPool) {
            relayUrls.push(...this.ndk.outboxPool.urls());
        }

        const uniqueRelays = Array.from(new Set(relayUrls));

        if (uniqueRelays.length === 0) return undefined;

        try {
            return NDKRelaySet.fromRelayUrls(uniqueRelays, this.ndk);
        } catch (error) {
            console.warn('Failed to build relay set for provider configs:', error);
            return undefined;
        }
    }

    /**
     * Parse a kind 10040 event to extract provider configurations
     */
    parseProviderEvent(event: NDKEvent): TrustedProvider[] {
        return this.parseProviderTags(event.tags as string[][]);
    }

    private parseProviderTags(tags: string[][]): TrustedProvider[] {
        const providers: TrustedProvider[] = [];

        tags.forEach((tag) => {
            if (tag.length < 3) return;

            const [kindTag, serviceKey, relayHint] = tag;
            if (!kindTag || !serviceKey || !relayHint) return;

            // Only accept kind:tag format (e.g., "30382:rank")
            if (!/^\d+:.+/.test(kindTag)) return;

            const parts = kindTag.split(':');
            if (parts.length !== 2) return;

            const kind = parseInt(parts[0] as string, 10);
            const tagName = parts[1] as string;

            if (isNaN(kind) || !tagName) return;

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

        const relaySet = this.buildRelaySet();

        const events = relaySet
            ? await this.ndk.fetchEvents(
                  filter,
                  {
                      closeOnEose: true,
                      groupable: false,
                  },
                  relaySet
              )
            : await this.ndk.fetchEvents(filter, {
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

        const relaySet = this.buildRelaySet();

        const events = relaySet
            ? await this.ndk.fetchEvents(
                  filter,
                  {
                      closeOnEose: true,
                      groupable: true,
                  },
                  relaySet
              )
            : await this.ndk.fetchEvents(filter, {
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
            const signer = this.ndk.signer as
                | {
                      user: () => Promise<unknown>;
                      encrypt?: (user: unknown, payload: string) => Promise<string> | string;
                      nip44Encrypt?: (user: unknown, payload: string) => Promise<string> | string;
                  }
                | undefined;
            if (!signer) {
                throw new Error('Signer not available for NIP-44 encryption');
            }

            const user = await signer.user();
            if (!user) {
                throw new Error('Signer user not available for NIP-44 encryption');
            }

            const payload = JSON.stringify(
                providers.map((provider) => [
                    provider.kindTag,
                    provider.serviceKey,
                    provider.relayHint,
                ])
            );

            const encrypted = signer.nip44Encrypt
                ? await signer.nip44Encrypt(user, payload)
                : await signer.encrypt?.(user, payload);
            if (!encrypted) {
                throw new Error('Failed to encrypt provider config with NIP-44');
            }

            event.tags = [];
            event.content = encrypted;
        } else {
            // Public tags
            event.tags = providers.map((p) => [p.kindTag, p.serviceKey, p.relayHint]);
            event.content = '';
        }

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

        const relaySet = this.buildRelaySet();

        const events = relaySet
            ? await this.ndk.fetchEvents(
                  filter,
                  {
                      closeOnEose: true,
                      groupable: false,
                  },
                  relaySet
              )
            : await this.ndk.fetchEvents(filter, {
                  closeOnEose: true,
                  groupable: false,
              });

        if (events.size === 0) return [];

        const event = Array.from(events)[0];
        console.log('[nip85] fetched provider config event', {
            id: event?.id,
            pubkey: event?.pubkey,
            created_at: event?.created_at,
            tags: event?.tags,
            content: event?.content,
        });

        if (event?.tags?.length) {
            return this.parseProviderEvent(event as NDKEvent);
        }

        if (!event?.content) return [];

        try {
            const signer = this.ndk.signer as
                | {
                      user: () => Promise<unknown>;
                      decrypt?: (user: unknown, payload: string) => Promise<string> | string;
                      nip44Decrypt?: (user: unknown, payload: string) => Promise<string> | string;
                  }
                | undefined;
            if (!signer) {
                throw new Error('Signer not available to decrypt provider config');
            }

            const user = await signer.user();
            if (!user) {
                throw new Error('Signer user not available to decrypt provider config');
            }

            const decrypted = signer.nip44Decrypt
                ? await signer.nip44Decrypt(user, event.content)
                : await signer.decrypt?.(user, event.content);
            if (!decrypted) {
                throw new Error('Failed to decrypt provider config with NIP-44');
            }

            const parsed = JSON.parse(decrypted);
            if (!Array.isArray(parsed)) return [];

            const tags = parsed.filter(
                (tag: unknown): tag is string[] =>
                    Array.isArray(tag) && tag.every((value) => typeof value === 'string')
            );

            return this.parseProviderTags(tags);
        } catch (error) {
            console.warn('Failed to decrypt provider config', error);
            return [];
        }
    }
}
