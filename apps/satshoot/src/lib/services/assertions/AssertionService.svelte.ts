import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, type Hexpubkey, type NDKFilter, type NDKTag } from '@nostr-dev-kit/ndk';
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

    constructor(ndk: NDK, useCache = true) {
        this.ndk = ndk;
        this.useCache = useCache;
    }

    private parseNumberValue(value: string | undefined): number | null {
        if (value === undefined || value === '') return null;
        const numValue = Number(value);
        return Number.isNaN(numValue) ? null : numValue;
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
        providers: TrustedProvider[]
    ): Promise<Map<string, UserAssertion>> {
        // Filter providers for user assertions
        const userProviders = providers.filter((p) => p.kind === NIP85_USER_ASSERTION_KIND);

        if (userProviders.length === 0) {
            return new Map();
        }

        const assertions = new Map<string, UserAssertion>();

        // Fetch from each provider
        for (const provider of userProviders) {
            try {
                const key = `${provider.serviceKey}:${provider.tag}`;

                // Check cache first
                if (this.useCache) {
                    const cached = await assertionCache.getUserAssertion(
                        pubkey,
                        provider.serviceKey,
                        provider.tag
                    );

                    if (cached) {
                        assertions.set(key, cached);
                        continue;
                    }
                }

                // Fetch from network
                const filter: NDKFilter = {
                    kinds: [NIP85_USER_ASSERTION_KIND],
                    authors: [provider.serviceKey],
                    '#d': [pubkey],
                };

                const events = await this.ndk.fetchEvents(filter, {
                    closeOnEose: true,
                    groupable: false,
                });

                events.forEach((event) => {
                    const assertion = this.parseUserAssertion(event);
                    if (assertion) {
                        assertions.set(key, assertion);

                        // Cache the assertion
                        if (this.useCache) {
                            assertionCache.setUserAssertion(
                                pubkey,
                                provider.serviceKey,
                                provider.tag,
                                assertion
                            );
                        }
                    }
                });
            } catch (error) {
                console.warn(`Failed to fetch from provider ${provider.serviceKey}:`, error);
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

        for (const provider of eventProviders) {
            try {
                const key = `${provider.serviceKey}:${provider.tag}`;

                if (this.useCache) {
                    const cached = await assertionCache.getEventAssertion(
                        eventId,
                        provider.serviceKey,
                        provider.tag
                    );

                    if (cached) {
                        assertions.set(key, cached);
                        continue;
                    }
                }

                const filter: NDKFilter = {
                    kinds: [NIP85_EVENT_ASSERTION_KIND],
                    authors: [provider.serviceKey],
                    '#d': [eventId],
                };

                const events = await this.ndk.fetchEvents(filter, {
                    closeOnEose: true,
                    groupable: false,
                });

                events.forEach((event) => {
                    const assertion = this.parseEventAssertion(event);
                    if (assertion) {
                        assertions.set(key, assertion);

                        if (this.useCache) {
                            assertionCache.setEventAssertion(
                                eventId,
                                provider.serviceKey,
                                provider.tag,
                                assertion
                            );
                        }
                    }
                });
            } catch (error) {
                console.warn(`Failed to fetch from provider ${provider.serviceKey}:`, error);
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

        for (const provider of addressableProviders) {
            try {
                const key = `${provider.serviceKey}:${provider.tag}`;

                if (this.useCache) {
                    const cached = await assertionCache.getAddressableAssertion(
                        address,
                        provider.serviceKey,
                        provider.tag
                    );

                    if (cached) {
                        assertions.set(key, cached);
                        continue;
                    }
                }

                const filter: NDKFilter = {
                    kinds: [NIP85_ADDRESSABLE_ASSERTION_KIND],
                    authors: [provider.serviceKey],
                    '#d': [address],
                };

                const events = await this.ndk.fetchEvents(filter, {
                    closeOnEose: true,
                    groupable: false,
                });

                events.forEach((event) => {
                    const assertion = this.parseAddressableAssertion(event);
                    if (assertion) {
                        assertions.set(key, assertion);

                        if (this.useCache) {
                            assertionCache.setAddressableAssertion(
                                address,
                                provider.serviceKey,
                                provider.tag,
                                assertion
                            );
                        }
                    }
                });
            } catch (error) {
                console.warn(`Failed to fetch from provider ${provider.serviceKey}:`, error);
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
