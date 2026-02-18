import type { Hexpubkey } from '@nostr-dev-kit/ndk';

/**
 * NIP-85 Trusted Assertion Types
 */

// Kind 30382: User Assertions
export interface UserAssertion {
    pubkey: Hexpubkey;
    rank?: number; // 0-100
    followers?: number;
    firstCreatedAt?: number;
    postCnt?: number;
    replyCnt?: number;
    reactionsCnt?: number;
    zapAmtRecd?: number;
    zapAmtSent?: number;
    zapCntRecd?: number;
    zapCntSent?: number;
    zapAvgAmtDayRecd?: number;
    zapAvgAmtDaySent?: number;
    reportsCntRecd?: number;
    reportsCntSent?: number;
    commonTopics?: string[];
    activeHoursStart?: number;
    activeHoursEnd?: number;
}

// Kind 30383: Event Assertions
export interface EventAssertion {
    eventId: string;
    rank?: number;
    commentCnt?: number;
    quoteCnt?: number;
    repostCnt?: number;
    reactionCnt?: number;
    zapCnt?: number;
    zapAmount?: number;
}

// Kind 30384: Addressable Event Assertions
export interface AddressableAssertion {
    address: string;
    rank?: number;
    commentCnt?: number;
    quoteCnt?: number;
    repostCnt?: number;
    reactionCnt?: number;
    zapCnt?: number;
    zapAmount?: number;
}

// Kind 30385: External Identifier Assertions
export interface ExternalAssertion {
    identifier: string;
    rank?: number;
    commentCnt?: number;
    reactionCnt?: number;
}

/**
 * Provider Configuration (Kind 10040)
 */
export interface TrustedProvider {
    // Format: "kind:tag" (e.g., "30382:rank")
    kindTag: string;
    // Service provider's pubkey
    serviceKey: Hexpubkey;
    // Relay hint where assertions are published
    relayHint: string;
    // Parsed kind and tag for convenience
    kind: number;
    tag: string;
}

/**
 * Provider with usage statistics from WoT
 */
export interface RankedProvider {
    provider: TrustedProvider;
    // Number of people in WoT using this provider
    usageCount: number;
    // Profile metadata if available
    name?: string;
    about?: string;
    picture?: string;
    website?: string;
}

/**
 * Aggregated provider info by service key
 */
export interface ProviderInfo {
    serviceKey: Hexpubkey;
    relayHint: string;
    name?: string;
    about?: string;
    picture?: string;
    website?: string;
    // Map of kind:tag to usage count
    capabilities: Map<string, number>;
    totalUsageCount: number;
}

/**
 * User's provider selection state
 */
export interface ProviderSelection {
    serviceKey: Hexpubkey;
    kindTag: string;
    selected: boolean;
}
