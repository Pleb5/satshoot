import type { NDKKind } from '@nostr-dev-kit/ndk';

export const ExtendedNDKKind = {
    FreelanceService: 32765 as NDKKind,
    FreelanceOrder: 32766 as NDKKind,
    FreelanceJob: 32767 as NDKKind,
    FreelanceBid: 32768 as NDKKind,
    Review: 1986 as NDKKind,
    KindScopedFollow: 967 as NDKKind,
    // NIP-85 Trusted Assertions
    TrustedProviderConfig: 10040 as NDKKind,
    UserAssertion: 30382 as NDKKind,
    EventAssertion: 30383 as NDKKind,
    AddressableAssertion: 30384 as NDKKind,
    ExternalAssertion: 30385 as NDKKind,
};
