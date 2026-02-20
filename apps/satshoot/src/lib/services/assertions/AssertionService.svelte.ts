import type NDK from '@nostr-dev-kit/ndk';
import {
    NDKEvent,
    NDKRelaySet,
    type Hexpubkey,
    type NDKFilter,
    type NDKTag,
} from '@nostr-dev-kit/ndk';
import type {
    TrustedProvider,
    UserAssertion,
    EventAssertion,
    AddressableAssertion,
    ExternalAssertion,
} from './types';
import {
    NIP85_USER_ASSERTION_KIND,
    NIP85_EVENT_ASSERTION_KIND,
    NIP85_ADDRESSABLE_ASSERTION_KIND,
    NIP85_EXTERNAL_ASSERTION_KIND,
} from './AssertionProviderConfig.svelte';
import { assertionCache } from './AssertionCache';

/**
 * Service to fetch and parse NIP-85 Trusted Assertion events
 */
export class AssertionService {
    private ndk: NDK;
    private useCache: boolean;
    private logEvents = false;

    constructor(ndk: NDK, useCache = true) {
        this.ndk = ndk;
        this.useCache = useCache;
    }

    setLogEvents(enabled: boolean) {
        this.logEvents = enabled;
    }

    private parseNumberValue(value: string | undefined): number | null {
        if (value === undefined || value === '') return null;
        const numValue = Number(value);
        return Number.isNaN(numValue) ? null : numValue;
    }

    private buildRelaySet(relayHints: string[]): NDKRelaySet | undefined {
        const relayUrls = relayHints
            .map((hint) => hint?.trim())
            .filter((hint): hint is string => Boolean(hint));
        const uniqueRelayUrls = Array.from(new Set(relayUrls));

        if (uniqueRelayUrls.length === 0) return undefined;

        try {
            return NDKRelaySet.fromRelayUrls(uniqueRelayUrls, this.ndk);
        } catch (error) {
            console.warn('Failed to build relay set for assertions:', error);
            return undefined;
        }
    }

    private getLatestEvent(events: Set<NDKEvent>): NDKEvent | null {
        let latestEvent: NDKEvent | null = null;

        events.forEach((event) => {
            const createdAt = event.created_at ?? 0;
            if (!latestEvent || createdAt > (latestEvent.created_at ?? 0)) {
                latestEvent = event;
            }
        });

        return latestEvent;
    }

    private async fetchAssertionEvents(
        filter: NDKFilter,
        relaySet?: NDKRelaySet
    ): Promise<Set<NDKEvent>> {
        const options = {
            closeOnEose: true,
            groupable: false,
        };

        if (relaySet) {
            return this.ndk.fetchEvents(filter, options, relaySet);
        }

        return this.ndk.fetchEvents(filter, options);
    }

    private async getCachedUserAssertionForProvider(
        pubkey: Hexpubkey,
        serviceKey: Hexpubkey,
        providers: TrustedProvider[]
    ): Promise<UserAssertion | null> {
        for (const provider of providers) {
            const cached = await assertionCache.getUserAssertion(
                pubkey,
                serviceKey,
                provider.tag
            );

            if (cached) {
                return cached;
            }
        }

        return null;
    }

    private async getCachedEventAssertionForProvider(
        eventId: string,
        serviceKey: Hexpubkey,
        providers: TrustedProvider[]
    ): Promise<EventAssertion | null> {
        for (const provider of providers) {
            const cached = await assertionCache.getEventAssertion(
                eventId,
                serviceKey,
                provider.tag
            );

            if (cached) {
                return cached;
            }
        }

        return null;
    }

    private async getCachedAddressableAssertionForProvider(
        address: string,
        serviceKey: Hexpubkey,
        providers: TrustedProvider[]
    ): Promise<AddressableAssertion | null> {
        for (const provider of providers) {
            const cached = await assertionCache.getAddressableAssertion(
                address,
                serviceKey,
                provider.tag
            );

            if (cached) {
                return cached;
            }
        }

        return null;
    }

    /**
     * Parse a user assertion event (kind 30382)
     */
    private parseUserAssertion(event: NDKEvent): UserAssertion | null {
        try {
            const pubkey = event.tagValue('d');
            if (!pubkey) return null;

            const assertion: UserAssertion = {
                pubkey: pubkey as Hexpubkey,
            };

            // Parse all available tags
            event.tags.forEach((tag: NDKTag) => {
                const [name, value] = tag;
                if (!name) return;

                const numValue = this.parseNumberValue(value);

                switch (name) {
                    case 'rank':
                        if (numValue !== null) assertion.rank = numValue;
                        break;
                    case 'followers':
                        if (numValue !== null) assertion.followers = numValue;
                        break;
                    case 'first_created_at':
                        if (numValue !== null) assertion.firstCreatedAt = numValue;
                        break;
                    case 'post_cnt':
                        if (numValue !== null) assertion.postCnt = numValue;
                        break;
                    case 'reply_cnt':
                        if (numValue !== null) assertion.replyCnt = numValue;
                        break;
                    case 'reactions_cnt':
                        if (numValue !== null) assertion.reactionsCnt = numValue;
                        break;
                    case 'zap_amt_recd':
                        if (numValue !== null) assertion.zapAmtRecd = numValue;
                        break;
                    case 'zap_amt_sent':
                        if (numValue !== null) assertion.zapAmtSent = numValue;
                        break;
                    case 'zap_cnt_recd':
                        if (numValue !== null) assertion.zapCntRecd = numValue;
                        break;
                    case 'zap_cnt_sent':
                        if (numValue !== null) assertion.zapCntSent = numValue;
                        break;
                    case 'zap_avg_amt_day_recd':
                        if (numValue !== null) assertion.zapAvgAmtDayRecd = numValue;
                        break;
                    case 'zap_avg_amt_day_sent':
                        if (numValue !== null) assertion.zapAvgAmtDaySent = numValue;
                        break;
                    case 'reports_cnt_recd':
                        if (numValue !== null) assertion.reportsCntRecd = numValue;
                        break;
                    case 'reports_cnt_sent':
                        if (numValue !== null) assertion.reportsCntSent = numValue;
                        break;
                    case 'active_hours_start':
                        if (numValue !== null) assertion.activeHoursStart = numValue;
                        break;
                    case 'active_hours_end':
                        if (numValue !== null) assertion.activeHoursEnd = numValue;
                        break;
                    case 't':
                        if (value === undefined || value === '') return;
                        if (!assertion.commonTopics) assertion.commonTopics = [];
                        assertion.commonTopics.push(value);
                        break;
                    case 'd':
                        break;
                    default:
                        if (value === undefined || value === '') return;
                        if (!assertion.extraMetrics) assertion.extraMetrics = {};
                        assertion.extraMetrics[name] = numValue !== null ? numValue : value;
                        break;
                }
            });

            return assertion;
        } catch (error) {
            console.warn('Failed to parse user assertion:', error);
            return null;
        }
    }

    /**
     * Parse an event assertion (kind 30383)
     */
    private parseEventAssertion(event: NDKEvent): EventAssertion | null {
        try {
            const eventId = event.tagValue('d');
            if (!eventId) return null;

            const assertion: EventAssertion = {
                eventId,
            };

            event.tags.forEach((tag: NDKTag) => {
                const [name, value] = tag;
                if (!name) return;

                const numValue = this.parseNumberValue(value);
                if (numValue === null) return;

                switch (name) {
                    case 'rank':
                        assertion.rank = numValue;
                        break;
                    case 'comment_cnt':
                        assertion.commentCnt = numValue;
                        break;
                    case 'quote_cnt':
                        assertion.quoteCnt = numValue;
                        break;
                    case 'repost_cnt':
                        assertion.repostCnt = numValue;
                        break;
                    case 'reaction_cnt':
                        assertion.reactionCnt = numValue;
                        break;
                    case 'zap_cnt':
                        assertion.zapCnt = numValue;
                        break;
                    case 'zap_amount':
                        assertion.zapAmount = numValue;
                        break;
                }
            });

            return assertion;
        } catch (error) {
            console.warn('Failed to parse event assertion:', error);
            return null;
        }
    }

    /**
     * Parse an addressable assertion (kind 30384)
     */
    private parseAddressableAssertion(event: NDKEvent): AddressableAssertion | null {
        try {
            const address = event.tagValue('d');
            if (!address) return null;

            const assertion: AddressableAssertion = {
                address,
            };

            event.tags.forEach((tag: NDKTag) => {
                const [name, value] = tag;
                if (!name) return;

                const numValue = this.parseNumberValue(value);
                if (numValue === null) return;

                switch (name) {
                    case 'rank':
                        assertion.rank = numValue;
                        break;
                    case 'comment_cnt':
                        assertion.commentCnt = numValue;
                        break;
                    case 'quote_cnt':
                        assertion.quoteCnt = numValue;
                        break;
                    case 'repost_cnt':
                        assertion.repostCnt = numValue;
                        break;
                    case 'reaction_cnt':
                        assertion.reactionCnt = numValue;
                        break;
                    case 'zap_cnt':
                        assertion.zapCnt = numValue;
                        break;
                    case 'zap_amount':
                        assertion.zapAmount = numValue;
                        break;
                }
            });

            return assertion;
        } catch (error) {
            console.warn('Failed to parse addressable assertion:', error);
            return null;
        }
    }

    /**
     * Parse an external identifier assertion (kind 30385)
     */
    private parseExternalAssertion(event: NDKEvent): ExternalAssertion | null {
        try {
            const identifier = event.tagValue('d');
            if (!identifier) return null;

            const assertion: ExternalAssertion = {
                identifier,
            };

            event.tags.forEach((tag: NDKTag) => {
                const [name, value] = tag;
                if (!name) return;

                const numValue = this.parseNumberValue(value);
                if (numValue === null) return;

                switch (name) {
                    case 'rank':
                        assertion.rank = numValue;
                        break;
                    case 'comment_cnt':
                        assertion.commentCnt = numValue;
                        break;
                    case 'reaction_cnt':
                        assertion.reactionCnt = numValue;
                        break;
                }
            });

            return assertion;
        } catch (error) {
            console.warn('Failed to parse external assertion:', error);
            return null;
        }
    }

    /**
     * Fetch user assertions from configured providers
     */
    async fetchUserAssertions(
        pubkey: Hexpubkey,
        providers: TrustedProvider[],
        logEvents = false
    ): Promise<Map<string, UserAssertion>> {
        const globalScope = globalThis as typeof globalThis & {
            __NIP85_LOG__?: boolean;
        };
        const shouldLog = logEvents || this.logEvents || globalScope.__NIP85_LOG__ === true;
        const shouldSkipCache = shouldLog;

        // Filter providers for user assertions
        const userProviders = providers.filter((p) => p.kind === NIP85_USER_ASSERTION_KIND);

        if (userProviders.length === 0) {
            return new Map();
        }

        const assertions = new Map<string, UserAssertion>();
        const providersByServiceKey = new Map<Hexpubkey, TrustedProvider[]>();

        userProviders.forEach((provider) => {
            const existing = providersByServiceKey.get(provider.serviceKey) ?? [];
            existing.push(provider);
            providersByServiceKey.set(provider.serviceKey, existing);
        });

        for (const [serviceKey, serviceProviders] of providersByServiceKey) {
            try {
                let cachedAssertion: UserAssertion | null = null;
                if (this.useCache && !shouldSkipCache) {
                    cachedAssertion = await this.getCachedUserAssertionForProvider(
                        pubkey,
                        serviceKey,
                        serviceProviders
                    );
                }

                if (cachedAssertion) {
                    serviceProviders.forEach((provider) => {
                        const key = `${serviceKey}:${provider.tag}`;
                        assertions.set(key, cachedAssertion);

                        if (this.useCache) {
                            assertionCache.setUserAssertion(
                                pubkey,
                                serviceKey,
                                provider.tag,
                                cachedAssertion
                            );
                        }
                    });
                    continue;
                }

                const relayUrls = Array.from(
                    new Set(
                        serviceProviders
                            .map((provider) => provider.relayHint?.trim())
                            .filter((hint): hint is string => Boolean(hint))
                    )
                );
                const relaySet = this.buildRelaySet(relayUrls);
                const filter: NDKFilter = {
                    kinds: [NIP85_USER_ASSERTION_KIND],
                    authors: [serviceKey],
                    '#d': [pubkey],
                };

                if (shouldLog) {
                    console.warn('[nip85] fetching user assertions', {
                        provider: serviceKey,
                        target: pubkey,
                        filter,
                        relayUrls: relayUrls.length > 0 ? relayUrls : 'ndk default relays',
                    });
                }

                const events = await this.fetchAssertionEvents(filter, relaySet);
                const latestEvent = this.getLatestEvent(events);

                if (!latestEvent) {
                    if (shouldLog) {
                        console.warn('[nip85] no user assertion events found', {
                            provider: serviceKey,
                            target: pubkey,
                            eventCount: events.size,
                        });
                    }
                    continue;
                }

                if (shouldLog) {
                    console.warn('[nip85] fetched user assertion event', {
                        provider: serviceKey,
                        target: pubkey,
                        id: latestEvent.id,
                        created_at: latestEvent.created_at,
                        tags: latestEvent.tags,
                        content: latestEvent.content,
                    });
                }

                const assertion = this.parseUserAssertion(latestEvent);
                if (!assertion) {
                    continue;
                }

                serviceProviders.forEach((provider) => {
                    const key = `${serviceKey}:${provider.tag}`;
                    assertions.set(key, assertion);

                    if (this.useCache) {
                        assertionCache.setUserAssertion(
                            pubkey,
                            serviceKey,
                            provider.tag,
                            assertion
                        );
                    }
                });
            } catch (error) {
                console.warn(`Failed to fetch from provider ${serviceKey}:`, error);
            }
        }

        return assertions;
    }

    /**
     * Fetch event assertions from configured providers
     */
    async fetchEventAssertions(
        eventId: string,
        providers: TrustedProvider[]
    ): Promise<Map<string, EventAssertion>> {
        const eventProviders = providers.filter((p) => p.kind === NIP85_EVENT_ASSERTION_KIND);

        if (eventProviders.length === 0) {
            return new Map();
        }

        const assertions = new Map<string, EventAssertion>();
        const providersByServiceKey = new Map<Hexpubkey, TrustedProvider[]>();

        eventProviders.forEach((provider) => {
            const existing = providersByServiceKey.get(provider.serviceKey) ?? [];
            existing.push(provider);
            providersByServiceKey.set(provider.serviceKey, existing);
        });

        for (const [serviceKey, serviceProviders] of providersByServiceKey) {
            try {
                let cachedAssertion: EventAssertion | null = null;
                if (this.useCache) {
                    cachedAssertion = await this.getCachedEventAssertionForProvider(
                        eventId,
                        serviceKey,
                        serviceProviders
                    );
                }

                if (cachedAssertion) {
                    serviceProviders.forEach((provider) => {
                        const key = `${serviceKey}:${provider.tag}`;
                        assertions.set(key, cachedAssertion);

                        if (this.useCache) {
                            assertionCache.setEventAssertion(
                                eventId,
                                serviceKey,
                                provider.tag,
                                cachedAssertion
                            );
                        }
                    });
                    continue;
                }

                const relaySet = this.buildRelaySet(
                    serviceProviders.map((provider) => provider.relayHint)
                );
                const filter: NDKFilter = {
                    kinds: [NIP85_EVENT_ASSERTION_KIND],
                    authors: [serviceKey],
                    '#d': [eventId],
                };

                const events = await this.fetchAssertionEvents(filter, relaySet);
                const latestEvent = this.getLatestEvent(events);

                if (!latestEvent) {
                    continue;
                }

                const assertion = this.parseEventAssertion(latestEvent);
                if (!assertion) {
                    continue;
                }

                serviceProviders.forEach((provider) => {
                    const key = `${serviceKey}:${provider.tag}`;
                    assertions.set(key, assertion);

                    if (this.useCache) {
                        assertionCache.setEventAssertion(
                            eventId,
                            serviceKey,
                            provider.tag,
                            assertion
                        );
                    }
                });
            } catch (error) {
                console.warn(`Failed to fetch from provider ${serviceKey}:`, error);
            }
        }

        return assertions;
    }

    /**
     * Fetch addressable assertions from configured providers
     */
    async fetchAddressableAssertions(
        address: string,
        providers: TrustedProvider[]
    ): Promise<Map<string, AddressableAssertion>> {
        const addressableProviders = providers.filter(
            (p) => p.kind === NIP85_ADDRESSABLE_ASSERTION_KIND
        );

        if (addressableProviders.length === 0) {
            return new Map();
        }

        const assertions = new Map<string, AddressableAssertion>();
        const providersByServiceKey = new Map<Hexpubkey, TrustedProvider[]>();

        addressableProviders.forEach((provider) => {
            const existing = providersByServiceKey.get(provider.serviceKey) ?? [];
            existing.push(provider);
            providersByServiceKey.set(provider.serviceKey, existing);
        });

        for (const [serviceKey, serviceProviders] of providersByServiceKey) {
            try {
                let cachedAssertion: AddressableAssertion | null = null;
                if (this.useCache) {
                    cachedAssertion = await this.getCachedAddressableAssertionForProvider(
                        address,
                        serviceKey,
                        serviceProviders
                    );
                }

                if (cachedAssertion) {
                    serviceProviders.forEach((provider) => {
                        const key = `${serviceKey}:${provider.tag}`;
                        assertions.set(key, cachedAssertion);

                        if (this.useCache) {
                            assertionCache.setAddressableAssertion(
                                address,
                                serviceKey,
                                provider.tag,
                                cachedAssertion
                            );
                        }
                    });
                    continue;
                }

                const relaySet = this.buildRelaySet(
                    serviceProviders.map((provider) => provider.relayHint)
                );
                const filter: NDKFilter = {
                    kinds: [NIP85_ADDRESSABLE_ASSERTION_KIND],
                    authors: [serviceKey],
                    '#d': [address],
                };

                const events = await this.fetchAssertionEvents(filter, relaySet);
                const latestEvent = this.getLatestEvent(events);

                if (!latestEvent) {
                    continue;
                }

                const assertion = this.parseAddressableAssertion(latestEvent);
                if (!assertion) {
                    continue;
                }

                serviceProviders.forEach((provider) => {
                    const key = `${serviceKey}:${provider.tag}`;
                    assertions.set(key, assertion);

                    if (this.useCache) {
                        assertionCache.setAddressableAssertion(
                            address,
                            serviceKey,
                            provider.tag,
                            assertion
                        );
                    }
                });
            } catch (error) {
                console.warn(`Failed to fetch from provider ${serviceKey}:`, error);
            }
        }

        return assertions;
    }

    /**
     * Aggregate multiple assertions for the same metric
     * Returns average, min, max, count
     */
    aggregateMetric(
        assertions: Map<string, UserAssertion | EventAssertion | AddressableAssertion>,
        metricKey: keyof UserAssertion | keyof EventAssertion | keyof AddressableAssertion
    ): { average: number; min: number; max: number; count: number } | null {
        const values: number[] = [];

        assertions.forEach((assertion) => {
            const value = assertion[metricKey as keyof typeof assertion];
            if (typeof value === 'number') {
                values.push(value);
            }
        });

        if (values.length === 0) {
            return null;
        }

        const sum = values.reduce((acc, val) => acc + val, 0);
        const average = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return {
            average: Math.round(average),
            min,
            max,
            count: values.length,
        };
    }

    /**
     * Get the most trusted value for a metric (median)
     */
    getTrustedValue(
        assertions: Map<string, UserAssertion | EventAssertion | AddressableAssertion>,
        metricKey: keyof UserAssertion | keyof EventAssertion | keyof AddressableAssertion
    ): number | null {
        const values: number[] = [];

        assertions.forEach((assertion) => {
            const value = assertion[metricKey as keyof typeof assertion];
            if (typeof value === 'number') {
                values.push(value);
            }
        });

        if (values.length === 0) {
            return null;
        }

        // Return median
        values.sort((a, b) => a - b);
        const mid = Math.floor(values.length / 2);

        if (values.length % 2 === 0) {
            return Math.round(((values[mid - 1] as number) + (values[mid] as number)) / 2);
        } else {
            return values[mid] as number;
        }
    }
}
