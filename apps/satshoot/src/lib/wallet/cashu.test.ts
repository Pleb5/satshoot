import { broadcastEvent } from '$lib/utils/helpers';
import { NDKCashuMintList, NDKRelay, NDKRelaySet, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
import { getCashuMintRecommendations } from './cashu';

// Mock data
const MockRelayUrls = ['wss://relay.example.com'];

describe('publishCashuMintList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should publish cashuMintList event', async () => {
    const mockNDK = new NDKSvelte();

    const mockWallet = new NDKCashuWallet(mockNDK);
    mockWallet.mints = ['https://mock-mint-1.com', 'https://mock-mint-2.com'];
    mockWallet.relaySet = NDKRelaySet.fromRelayUrls(MockRelayUrls, mockNDK);
    await mockWallet.getP2pk();

    const cashuInfo = new NDKCashuMintList(mockNDK);
    cashuInfo.p2pk = mockWallet._p2pk;
    cashuInfo.relays = MockRelayUrls;
    cashuInfo.mints = mockWallet.mints;

    const publishReplaceable = vi
      .spyOn(NDKCashuMintList.prototype, 'publishReplaceable')
      .mockImplementation(() => {
        return Promise.resolve(new Set<NDKRelay>());
      });

    await broadcastEvent(mockNDK, cashuInfo, { replaceable: true });

    expect(publishReplaceable).toHaveBeenCalled();
  });
});

describe('getCashuMintRecommendations', () => {
  test('should fetch and sort mint recommendations', async () => {
    const mockNDK = new NDKSvelte();
    const mockWoT = new Set(['pubkey1', 'pubkey2']);

    const mockEvents: NDKEvent[] = [];

    for (let i = 0; i < 3; i++) {
      const event = new NDKEvent(mockNDK);
      event.pubkey = 'pubkey1';
      event.kind = NDKKind.CashuMintList;
      event.tags = [['mint', `https://mint${i}.com`]];
      mockEvents.push(event);
    }

    for (let i = 0; i < 3; i++) {
      const event = new NDKEvent(mockNDK);
      event.pubkey = 'pubkey2';
      event.kind = NDKKind.EcashMintRecommendation;
      event.tags = [['u', `https://ecash${i}.com`, 'cashu']];
      mockEvents.push(event);
    }

    vi.spyOn(mockNDK, 'fetchEvents').mockImplementation(() => {
      return Promise.resolve(new Set(mockEvents));
    });

    const result = await getCashuMintRecommendations(mockNDK, mockWoT);

    expect(mockNDK.fetchEvents).toHaveBeenCalledTimes(1);
    expect(Object.keys(result).length).toBe(6);

    for (let i = 0; i < 3; i++) {
      expect(result[`https://mint${i}.com`]).toBeDefined();
      expect(result[`https://ecash${i}.com`]).toBeDefined();
    }

    expect(result['https://mint0.com'].endorsementsByPubkey.get('pubkey1')?.nutzap).toBe(true);
    expect(result['https://ecash0.com'].endorsementsByPubkey.get('pubkey2')?.explicit).toBe(true);
  });

  test('should filter out recommendations from non-WoT publishers', async () => {
    const mockNDK = new NDKSvelte();
    const mockWoT = new Set(['trusted-pubkey']);

    const mockEvents: NDKEvent[] = [];

    const trustedEvent = new NDKEvent(mockNDK);
    trustedEvent.pubkey = 'trusted-pubkey';
    trustedEvent.kind = NDKKind.CashuMintList;
    trustedEvent.tags = [['mint', 'https://trusted-mint.com']];
    mockEvents.push(trustedEvent);

    const untrustedEvent = new NDKEvent(mockNDK);
    untrustedEvent.pubkey = 'untrusted-pubkey';
    untrustedEvent.kind = NDKKind.EcashMintRecommendation;
    untrustedEvent.tags = [['u', 'https://untrusted-mint.com', 'cashu']];
    mockEvents.push(untrustedEvent);

    vi.spyOn(mockNDK, 'fetchEvents').mockImplementation(() => {
      return Promise.resolve(new Set(mockEvents));
    });

    const result = await getCashuMintRecommendations(mockNDK, mockWoT);

    expect(Object.keys(result).length).toBe(1);
    expect(result['https://trusted-mint.com']).toBeDefined();
    expect(result['https://untrusted-mint.com']).toBeUndefined();
  });

  test('should count a pubkey once per mint', async () => {
    const mockNDK = new NDKSvelte();
    const mockWoT = new Set(['pubkey1']);

    const cashuListEvent = new NDKEvent(mockNDK);
    cashuListEvent.pubkey = 'pubkey1';
    cashuListEvent.kind = NDKKind.CashuMintList;
    cashuListEvent.tags = [['mint', 'https://shared-mint.com']];

    const explicitEvent = new NDKEvent(mockNDK);
    explicitEvent.pubkey = 'pubkey1';
    explicitEvent.kind = NDKKind.EcashMintRecommendation;
    explicitEvent.tags = [['u', 'https://shared-mint.com', 'cashu']];

    vi.spyOn(mockNDK, 'fetchEvents').mockImplementation(() => {
      return Promise.resolve(new Set([cashuListEvent, explicitEvent]));
    });

    const result = await getCashuMintRecommendations(mockNDK, mockWoT);

    expect(result['https://shared-mint.com'].pubkeys.size).toBe(1);
    expect(result['https://shared-mint.com'].endorsementsByPubkey.get('pubkey1')).toEqual({
      explicit: true,
      nutzap: true,
    });
  });
});
