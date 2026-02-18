# NIP-85 Trusted Assertion Providers Implementation

This document describes the implementation of NIP-85 Trusted Assertions in SatShoot, allowing users to configure and use trusted providers for reputation calculations.

## Overview

NIP-85 enables offloading Web-of-Trust calculations to trusted service providers who publish signed "Trusted Assertion" events. This implementation allows SatShoot users to:

1. Discover providers used by their Web of Trust
2. See providers ranked by usage count in their WoT
3. Select providers for different reputation metrics
4. Save their configuration as a kind 10040 event

## Architecture

### Core Components

#### 1. Type Definitions (`/src/lib/services/assertions/types.ts`)

Defines TypeScript interfaces for:
- `TrustedProvider` - Individual provider configuration
- `ProviderInfo` - Aggregated provider data with metadata
- `RankedProvider` - Provider with WoT usage statistics
- Assertion types for users, events, addressables, and external identifiers

#### 2. Service Layer (`/src/lib/services/assertions/AssertionProviderConfig.svelte.ts`)

Main service class handling:
- **Fetching**: Retrieves kind 10040 events from WoT pubkeys
- **Parsing**: Extracts provider configurations from events
- **Aggregation**: Counts provider usage across WoT
- **Metadata**: Enriches providers with kind 0 profile data
- **Ranking**: Sorts providers by WoT usage
- **Saving**: Publishes user's provider selection

**Key Methods**:
```typescript
parseProviderEvent(event: NDKEvent): TrustedProvider[]
fetchProviderConfigs(pubkeys: Hexpubkey[]): Promise<Map<...>>
aggregateProviderUsage(configs): Map<Hexpubkey, ProviderInfo>
fetchProviderMetadata(serviceKeys): Promise<Map<...>>
getRankedProvidersForKindTag(kindTag, providerInfoMap): RankedProvider[]
saveProviderConfig(providers, encrypt): Promise<NDKEvent>
```

#### 3. State Management (`/src/lib/stores/assertions.ts`)

Svelte stores for:
- `selectedProviders` - User's current selection
- `wotProviderConfigs` - Configs from WoT members
- `providerInfoMap` - Aggregated provider data
- `availableCapabilities` - Derived set of all kind:tag combinations
- `loadingProviders` - Loading state
- `showTrustedProvidersModal` - Modal visibility

**Key Functions**:
```typescript
loadWoTProviderConfigs(): Promise<void>
loadUserProviderConfig(): Promise<void>
saveProviderSelection(providers): Promise<void>
getRankedProvidersForCapability(kindTag): RankedProvider[]
toggleProviderSelection(provider): void
```

#### 4. UI Components

##### TrustedProvidersModal (`/src/lib/components/Modals/TrustedProvidersModal.svelte`)

Modal dialog featuring:
- **Capability Selector**: Dropdown to choose assertion type (e.g., "User - Rank")
- **Provider List**: Checkboxes for each provider, ranked by WoT usage
- **Provider Cards**: Display name, picture, about, website, and usage count
- **Summary**: Total selected providers
- **Actions**: Save or cancel

**Features**:
- Reactive updates when capability changes
- Visual feedback for selected providers
- Loading states
- Error handling with toasts

##### Settings Integration (`/src/routes/settings/general/+page.svelte`)

Added to General Settings:
- Button to open provider modal
- Display count of configured providers
- Tooltip explaining NIP-85
- Auto-loads user's existing config on mount
- Fetches WoT configs before opening modal

## NIP-85 Event Kinds

The implementation supports these event kinds:

| Kind  | Purpose                    | d tag value       |
|-------|----------------------------|-------------------|
| 10040 | Provider Configuration     | N/A               |
| 30382 | User Assertions            | `<pubkey>`        |
| 30383 | Event Assertions           | `<event_id>`      |
| 30384 | Addressable Assertions     | `<event_address>` |
| 30385 | External ID Assertions     | `<i-tag>`         |

## Supported Assertion Tags

### User Assertions (30382)

- `rank` - Overall WoT score (0-100)
- `followers` - Follower count
- `zap_amt_recd` / `zap_amt_sent` - Zap amounts
- `post_cnt`, `reply_cnt`, `reactions_cnt` - Activity metrics
- `reports_cnt_recd` - Warning signals

### Event Assertions (30383/30384)

- `rank` - Event/address quality score
- `comment_cnt`, `quote_cnt`, `repost_cnt` - Engagement
- `zap_amount`, `zap_cnt` - Payment validation

## User Flow

### Initial Setup

1. User navigates to Settings > General
2. Clicks "Configure" button for Trusted Assertion Providers
3. System loads kind 10040 events from user's Web of Trust
4. Modal opens showing available providers

### Provider Selection

1. User selects capability from dropdown (e.g., "User - Rank")
2. Providers are displayed ranked by WoT usage
3. User checks/unchecks providers
4. Can select multiple providers for same capability
5. Can configure different providers for different capabilities

### Saving Configuration

1. User clicks "Save Configuration"
2. System creates kind 10040 event with selected providers
3. Event contains public tags: `[kind:tag, serviceKey, relayHint]`
4. Event is published to user's relays
5. Success toast confirms save

### Viewing Configuration

- Settings page shows count of configured providers
- Modal displays checkmarks next to selected providers
- Can be edited at any time

## Provider Discovery Algorithm

```typescript
// 1. Fetch kind 10040 from WoT
const configs = await service.fetchProviderConfigs(wotPubkeys);

// 2. Aggregate by service key
const aggregated = service.aggregateProviderUsage(configs);
// Result: Map<serviceKey, { capabilities: Map<kind:tag, usageCount> }>

// 3. Fetch metadata for providers
const metadata = await service.fetchProviderMetadata(serviceKeys);

// 4. Enrich with profiles
service.enrichWithMetadata(aggregated, metadata);

// 5. Rank by usage for specific capability
const ranked = service.getRankedProvidersForKindTag(kindTag, aggregated);
// Sorted descending by usageCount
```

## Data Flow

```
User Action (Settings)
  ↓
loadWoTProviderConfigs()
  ↓
Fetch kind 10040 from WoT → Parse events → Aggregate usage
  ↓                              ↓              ↓
NDK Filter              TrustedProvider[]   Map<serviceKey, ProviderInfo>
  ↓
Fetch kind 0 for providers → Enrich metadata
  ↓
Update stores → Modal renders ranked list
  ↓
User selects → toggleProviderSelection()
  ↓
Click Save → saveProviderSelection()
  ↓
Publish kind 10040 → Update selectedProviders store
```

## Integration Points

### Current Integration

The implementation is currently **display-only**. It allows users to:
- Discover providers from their WoT
- Configure their preferences
- Save their configuration

### Future Integration Opportunities

To actually **use** the assertions:

#### 1. Reputation Service Enhancement

```typescript
// In ReputationService.svelte.ts
async initialize() {
    // ... existing code ...
    
    // NEW: Fetch assertions if providers configured
    if (this.hasConfiguredProviders()) {
        this.assertionService = new AssertionService();
        const assertions = await this.assertionService.fetchUserAssertions(this.user);
        this.enrichWithAssertions(assertions);
    }
}

get reputationData(): ReputationData {
    return {
        financial: { /* ... */ },
        clientAverage: this.clientAverage,
        freelancerAverage: this.freelancerAverage,
        overallAverage: this.overallAverage,
        // NEW: Add assertion data
        assertions: this.assertionData,
        isInitialized: this.isInitialized,
    };
}
```

#### 2. WoT Filtering Enhancement

```typescript
// In wot.ts - Optionally boost users with high assertion ranks
export const wot = derived(
    [networkWoTScores, /* ... */, userAssertions],
    ([$networkWoTScores, /* ... */, $userAssertions]) => {
        const pubkeys = new Set<Hexpubkey>();
        
        // Existing WoT logic...
        
        // OPTIONAL: Include high-ranked users from assertions
        $userAssertions.forEach(assertion => {
            if (assertion.rank >= 80) {
                pubkeys.add(assertion.pubkey);
            }
        });
        
        return pubkeys;
    }
);
```

#### 3. Profile Display

```svelte
<!-- In user profile pages -->
{#if assertionData}
    <div class="trusted-assertions">
        <h4>Trusted Provider Metrics</h4>
        <Metric label="WoT Rank" value={assertionData.rank} max={100} />
        <Metric label="Followers" value={assertionData.followers} />
        <small>Data from {providerName}</small>
    </div>
{/if}
```

## Security Considerations

### Trust Model

- Users control which providers they trust
- Providers are discovered through social graph (WoT)
- Multiple providers can be used for redundancy
- Each provider uses a dedicated service key per algorithm

### Privacy

Current implementation uses **public** provider configuration:
```json
{
  "kind": 10040,
  "tags": [
    ["30382:rank", "<service_pubkey>", "wss://relay.example.com"]
  ]
}
```

Future enhancement can support **encrypted** configuration using NIP-44:
```json
{
  "kind": 10040,
  "content": "<encrypted_json>",
  "tags": []
}
```

### Verification

Assertion events are signed by service providers:
- Verify event signature matches service key
- Check event is published to declared relay
- Cross-reference with multiple providers
- Users can audit provider reliability over time

## Testing

### Manual Testing Checklist

- [ ] Open Settings > General
- [ ] Click "Configure" for Trusted Providers
- [ ] Verify modal opens
- [ ] Check loading state appears
- [ ] Select different capabilities from dropdown
- [ ] Verify providers list updates
- [ ] Check providers are ranked by usage count
- [ ] Select/deselect providers
- [ ] Verify selection count updates
- [ ] Click Save
- [ ] Verify success toast
- [ ] Refresh page
- [ ] Verify count shows in settings
- [ ] Reopen modal
- [ ] Verify selections persisted

### Edge Cases

- Empty WoT (no providers found)
- No provider metadata available
- Network errors during fetch
- No kind 10040 in WoT
- Duplicate providers
- Invalid event formats

## Dependencies

- `@nostr-dev-kit/ndk` - Nostr client
- `svelte` - Reactive framework
- `@skeletonlabs/skeleton-svelte` - UI components (Modal)

## File Structure

```
src/lib/
├── services/
│   └── assertions/
│       ├── types.ts                            # TypeScript interfaces
│       └── AssertionProviderConfig.svelte.ts  # Main service class
├── stores/
│   └── assertions.ts                          # State management
├── components/
│   └── Modals/
│       └── TrustedProvidersModal.svelte       # UI component
└── types/
    └── ndkKind.ts                             # Event kind constants

src/routes/
├── +layout.svelte                             # Modal instantiation
└── settings/
    └── general/
        └── +page.svelte                       # Settings UI
```

## Configuration Examples

### Example kind 10040 Event

```json
{
  "kind": 10040,
  "pubkey": "user_pubkey_hex",
  "tags": [
    ["30382:rank", "provider1_pubkey", "wss://provider1.com"],
    ["30382:followers", "provider2_pubkey", "wss://provider2.com"],
    ["30383:rank", "provider1_pubkey", "wss://provider1.com"]
  ],
  "content": "",
  "created_at": 1234567890,
  "id": "...",
  "sig": "..."
}
```

### Example Provider Metadata (kind 0)

```json
{
  "kind": 0,
  "pubkey": "provider1_pubkey",
  "content": "{
    \"name\": \"TrustRank Service\",
    \"about\": \"Personalized Web of Trust ranking service\",
    \"picture\": \"https://example.com/logo.png\",
    \"website\": \"https://trustrank.example.com\"
  }",
  "tags": []
}
```

## Next Steps

To fully utilize NIP-85 in SatShoot:

1. **Create AssertionService** to fetch actual assertion events
2. **Integrate with ReputationService** to display assertion data
3. **Add UI components** to show assertion metrics on profiles
4. **Implement caching** for assertion events
5. **Add assertion refresh** logic
6. **Consider running** a SatShoot-native assertion provider
7. **Implement NIP-44 encryption** for private configurations
8. **Add provider verification** and reputation tracking

## Resources

- [NIP-85 Specification](https://github.com/nostr-protocol/nips/blob/master/85.md)
- [NIP-44 Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [SatShoot Event Structure](./EVENT_STRUCTURE.md)

## Contributors

This implementation provides the foundation for decentralized reputation calculations in SatShoot, empowering users to choose their trusted sources while maintaining censorship resistance.
