import { broadcastEvent } from '$lib/utils/helpers';
import type { Proof } from '@cashu/cashu-ts';
import { NDKCashuMintList, NDKRelay, NDKRelaySet, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuWallet, NDKNutzapMonitor } from '@nostr-dev-kit/ndk-wallet';
import {
    parseAndValidateBackup,
    serializeWallet,
    toWalletStorage,
    isValidBackup,
    recoverWallet,
    getCashuMintRecommendations,
    WALLET_BACKUP_VERSION,
} from './cashu';

// Mock data
const MockRelayUrls = ['wss://relay.example.com'];
const MockMints = ['https://mock-mint-1.com', 'https://mock-mint-2.com'];
const MockProofs: Proof[] = [
    {
        id: 'mock-proof-id',
        amount: 100,
        secret: 'mock-proof-secret',
        C: 'mock value',
    },
    {
        id: 'mock-proof-id',
        amount: 1000,
        secret: 'mock-proof-secret',
        C: 'mock value',
    },
];

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

describe('parseAndValidateBackup', () => {
    test('should parse and validate the content of ecash wallet backup file', async () => {
        const mockNDK = new NDKSvelte();

        const mockWallet = new NDKCashuWallet(mockNDK);
        mockWallet.mints = MockMints;
        mockWallet.relaySet = NDKRelaySet.fromRelayUrls(MockRelayUrls, mockNDK);
        await mockWallet.getP2pk();

        mockWallet.state.addProof({
            mint: MockMints[0],
            state: 'available',
            proof: MockProofs[0],
            timestamp: Date.now(),
        });

        mockWallet.state.addProof({
            mint: MockMints[1],
            state: 'available',
            proof: MockProofs[1],
            timestamp: Date.now(),
        });

        const walletStorage = toWalletStorage(mockWallet);
        const stringified = serializeWallet(walletStorage);

        const parsed = parseAndValidateBackup(stringified);

        expect(parsed).toBeTruthy();
        expect(parsed).toEqual(walletStorage);
    });

    test('should return null for invalid JSON', () => {
        const invalidJson = '{invalid: json';
        const result = parseAndValidateBackup(invalidJson);
        expect(result).toBeNull();
    });

    test('should return null when validation fails', () => {
        const invalidBackup = JSON.stringify({
            version: 'invalid',
            // Missing required properties
        });
        const result = parseAndValidateBackup(invalidBackup);
        expect(result).toBeNull();
    });
});

describe('isValidBackup', () => {
    test('should return true for valid backup', () => {
        const validBackup = {
            version: WALLET_BACKUP_VERSION,
            cashuKeys: { key1: 'value1', key2: null },
            mintsWithProofs: {
                mint1: [
                    {
                        id: 'proof-id',
                        amount: 100,
                        secret: 'secret',
                        C: 'value',
                    },
                ],
            },
        };

        expect(isValidBackup(validBackup)).toBeTruthy();
    });

    test('should return false for null backup', () => {
        expect(isValidBackup(null as any)).toBeFalsy();
    });

    test('should return false when version is missing', () => {
        const invalidBackup = {
            cashuKeys: { key1: 'value1' },
            mintsWithProofs: {},
        };

        expect(isValidBackup(invalidBackup as any)).toBeFalsy();
    });

    test('should return false when cashuKeys is invalid', () => {
        const invalidBackup = {
            version: WALLET_BACKUP_VERSION,
            cashuKeys: { key1: 123 }, // Number instead of string or null
            mintsWithProofs: {},
        };

        expect(isValidBackup(invalidBackup as any)).toBeFalsy();
    });

    test('should return false when mintsWithProofs is invalid', () => {
        const invalidBackup = {
            version: WALLET_BACKUP_VERSION,
            cashuKeys: { key1: 'value1' },
            mintsWithProofs: { mint1: 'not an array' },
        };

        expect(isValidBackup(invalidBackup as any)).toBeFalsy();
    });
});

describe('recoverWallet', () => {
    test('should recover wallet from storage', async () => {
        // Mock dependencies
        const mockWalletStorage = {
            cashuKeys: {
                p2pk1: 'mock-private-key',
                p2pk2: null,
            },
            mintsWithProofs: {
                [MockMints[0]]: MockProofs,
            },
            version: WALLET_BACKUP_VERSION,
        };

        const mockWallet = new NDKCashuWallet(new NDKSvelte());
        const addPrivkeySpy = vi.spyOn(mockWallet, 'addPrivkey').mockResolvedValue();

        const mockNutzapMonitor = { wallet: null } as unknown as NDKNutzapMonitor;

        await recoverWallet(mockWalletStorage, mockWallet, mockNutzapMonitor);

        // Check if private keys were added
        expect(addPrivkeySpy).toHaveBeenCalledWith('mock-private-key');
        expect(mockNutzapMonitor.wallet).toBe(mockWallet);
    });
});

describe('toWalletStorage', () => {
    test('should convert wallet to storage format', async () => {
        const mockNDK = new NDKSvelte();
        const mockWallet = new NDKCashuWallet(mockNDK);

        // Mock wallet state
        const mockMintsProofs = new Map();
        mockMintsProofs.set(MockMints[0], MockProofs);

        mockWallet.state = {
            getMintsProofs: vi.fn().mockReturnValue(mockMintsProofs),
        } as any;

        // Mock wallet privkeys
        const mockPrivateKey = 'mock-private-key';
        const mockPrivkeys = new Map();
        mockPrivkeys.set('p2pk1', { privateKey: mockPrivateKey });
        mockPrivkeys.set('p2pk2', { privateKey: null });
        mockWallet.privkeys = mockPrivkeys;

        const result = toWalletStorage(mockWallet);

        expect(result).toEqual({
            version: WALLET_BACKUP_VERSION,
            cashuKeys: {
                p2pk1: mockPrivateKey,
                p2pk2: null,
            },
            mintsWithProofs: {
                [MockMints[0]]: MockProofs,
            },
        });
    });
});

describe('serializeWallet', () => {
    test('should serialize wallet storage to JSON', () => {
        const walletStorage = {
            version: WALLET_BACKUP_VERSION,
            cashuKeys: { p2pk1: 'key1' },
            mintsWithProofs: { [MockMints[0]]: MockProofs },
        };

        const result = serializeWallet(walletStorage);
        const parsed = JSON.parse(result);

        expect(parsed).toEqual(walletStorage);
    });
});

describe('getCashuMintRecommendations', () => {
    test('should fetch and sort mint recommendations', async () => {
        const mockNDK = new NDKSvelte();
        const mockWoT = new Set(['pubkey1', 'pubkey2']);

        // Mock events
        const mockEvents: NDKEvent[] = [];

        // Create mock mint list events
        for (let i = 0; i < 3; i++) {
            const event = new NDKEvent(mockNDK);
            event.pubkey = 'pubkey1';
            event.kind = NDKKind.CashuMintList;
            event.tags = [['mint', `https://mint${i}.com`]];
            mockEvents.push(event);
        }

        // Create mock ecash recommendation events
        for (let i = 0; i < 3; i++) {
            const event = new NDKEvent(mockNDK);
            event.pubkey = 'pubkey2';
            event.kind = NDKKind.EcashMintRecommendation;
            event.tags = [['u', `https://ecash${i}.com`, 'cashu']];
            mockEvents.push(event);
        }

        // Mock the fetchEvents method
        vi.spyOn(mockNDK, 'fetchEvents').mockImplementation(() => {
            return Promise.resolve(new Set(mockEvents));
        });

        const result = await getCashuMintRecommendations(mockNDK, mockWoT);

        expect(mockNDK.fetchEvents).toHaveBeenCalledTimes(2);
        expect(Object.keys(result).length).toBe(6);

        // Check that all expected mints are in the result
        for (let i = 0; i < 3; i++) {
            expect(result[`https://mint${i}.com`]).toBeDefined();
            expect(result[`https://ecash${i}.com`]).toBeDefined();
        }
    });

    test('should filter out recommendations from non-WoT publishers', async () => {
        const mockNDK = new NDKSvelte();
        const mockWoT = new Set(['trusted-pubkey']);

        // Create events from both trusted and untrusted publishers
        const mockEvents: NDKEvent[] = [];

        // Trusted publisher event
        const trustedEvent = new NDKEvent(mockNDK);
        trustedEvent.pubkey = 'trusted-pubkey';
        trustedEvent.kind = NDKKind.CashuMintList;
        trustedEvent.tags = [['mint', 'https://trusted-mint.com']];
        mockEvents.push(trustedEvent);

        // Untrusted publisher event
        const untrustedEvent = new NDKEvent(mockNDK);
        untrustedEvent.pubkey = 'untrusted-pubkey';
        untrustedEvent.kind = NDKKind.CashuMintList;
        untrustedEvent.tags = [['mint', 'https://untrusted-mint.com']];
        mockEvents.push(untrustedEvent);

        vi.spyOn(mockNDK, 'fetchEvents').mockImplementation(() => {
            return Promise.resolve(new Set(mockEvents));
        });

        const result = await getCashuMintRecommendations(mockNDK, mockWoT);

        expect(Object.keys(result).length).toBe(1);
        expect(result['https://trusted-mint.com']).toBeDefined();
        expect(result['https://untrusted-mint.com']).toBeUndefined();
    });
});
