import ndk from '$lib/stores/ndk';
import {
    NDKCashuMintList,
    NDKKind,
    NDKPrivateKeySigner,
    NDKRelay,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuToken, NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
import { CashuWallet } from '@cashu/cashu-ts';
import {
    extractUnspentProofsForMint,
    findTokensWithDuplicateProofs,
    getUniqueProofs,
    parseAndValidateBackup,
    publishCashuMintList,
    removeDuplicateProofs,
} from './cashu';

describe('publishCashuMintList', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should publish cashuMintList event', async () => {
        const mockNDK = new NDKSvelte();
        ndk.set(mockNDK);

        const mockWallet = new NDKCashuWallet(mockNDK);
        const signer = NDKPrivateKeySigner.generate();
        mockWallet.privkey = signer.privateKey;

        const publishReplaceable = vi
            .spyOn(NDKCashuMintList.prototype, 'publishReplaceable')
            .mockImplementation(() => {
                return Promise.resolve(new Set<NDKRelay>());
            });

        await publishCashuMintList(mockWallet);

        expect(publishReplaceable).toHaveBeenCalled();
    });
});

describe('parseAndValidateBackup', () => {
    test('should parse and validate the content of ecash wallet backup file', () => {
        const json: { wallet: NostrEvent; tokens: NostrEvent[] } = {
            wallet: {
                created_at: Math.floor(Date.now() / 1000),
                content: 'string',
                tags: [],
                kind: NDKKind.CashuWallet,
                pubkey: 'mock pubkey',
            },
            tokens: [
                {
                    created_at: Math.floor(Date.now() / 1000),
                    content: 'string',
                    tags: [],
                    kind: NDKKind.CashuToken,
                    pubkey: 'mock pubkey',
                },
                {
                    created_at: Math.floor(Date.now() / 1000),
                    content: 'string',
                    tags: [],
                    kind: NDKKind.CashuToken,
                    pubkey: 'mock pubkey',
                },
            ],
        };

        const jsonString = JSON.stringify(json);

        const parsed = parseAndValidateBackup(jsonString);

        expect(parsed).toBeTruthy();
        expect(parsed).toEqual(json);
    });
});

describe('extractUnspentProofsForMint', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should return an array of unspent proofs', async () => {
        const checkProofsSpentSpyOn = vi
            .spyOn(CashuWallet.prototype, 'checkProofsSpent')
            .mockImplementation(() => {
                return Promise.resolve([]);
            });

        const mockMint = 'https://mock-mint.cash';
        const mockTokens = Array(5)
            .fill(0)
            .map((_) => {
                const token = new NDKCashuToken();
                token.proofs = [
                    {
                        id: 'mock proof id',
                        amount: 5,
                        secret: 'Mock secret',
                        C: 'Mock value',
                    },
                    {
                        id: 'mock proof id',
                        amount: 5,
                        secret: 'Mock secret',
                        C: 'Mock value',
                    },
                ];
                return token;
            });

        const unspentProofs = await extractUnspentProofsForMint(mockMint, mockTokens);

        expect(checkProofsSpentSpyOn).toHaveBeenCalled();
        expect(unspentProofs).toHaveLength(10);
    });
});

describe('findTokensWithDuplicateProofs', () => {
    test('should return an array of tokens with duplicate proofs', async () => {
        const mockTokens = Array(5)
            .fill(0)
            .map((_) => {
                const token = new NDKCashuToken();
                token.proofs = [
                    {
                        id: 'mock proof id',
                        amount: 5,
                        secret: 'Mock secret',
                        C: 'Mock value',
                    },
                    {
                        id: 'mock proof id',
                        amount: 5,
                        secret: 'Mock secret',
                        C: 'Mock value',
                    },
                ];
                return token;
            });

        const duplicateTokens = findTokensWithDuplicateProofs(mockTokens);

        expect(duplicateTokens).toHaveLength(5);
    });

    test('should return an empty array when none of the token contains duplicate proof', async () => {
        const mockTokens = Array(5)
            .fill(0)
            .map((_, index) => {
                const token = new NDKCashuToken();
                token.proofs = [
                    {
                        id: `mock proof id ${index}`,
                        amount: 5,
                        secret: 'Mock secret',
                        C: 'Mock value',
                    },
                ];
                return token;
            });

        const duplicateTokens = findTokensWithDuplicateProofs(mockTokens);

        expect(duplicateTokens).toHaveLength(0);
    });
});

describe('getUniqueProofs', () => {
    test('should return an array of unique proofs that are in array1 but not in array2', async () => {
        const mockProofs = Array(10)
            .fill(0)
            .map((_, index) => ({
                id: 'mock proof id',
                amount: index,
                secret: 'Mock secret',
                C: 'Mock value',
            }));

        // considering proof with amount as even number to be spent
        const spentProofs = mockProofs.filter((proof) => proof.amount % 2 === 0);

        // considering proof with amount as odd number to be spent
        const unspentProofs = mockProofs.filter((proof) => proof.amount % 2 !== 0);

        const result = getUniqueProofs(mockProofs, spentProofs);

        expect(result).toHaveLength(5);
        expect(result).toEqual(unspentProofs);
    });
});

describe('removeDuplicateProofs', () => {
    test('should remove any duplicate proof if exists', async () => {
        const mockProofs = Array(10)
            .fill(0)
            .map((_, index) => [
                {
                    id: 'mock proof id',
                    amount: index,
                    secret: 'Mock secret',
                    C: 'Mock value',
                },
                {
                    id: 'mock proof id',
                    amount: index,
                    secret: 'Mock secret',
                    C: 'Mock value',
                },
            ])
            .flat();

        const result = removeDuplicateProofs(mockProofs);

        expect(result).toHaveLength(10);
    });
});
