import ndk from '$lib/stores/ndk';
import {
    NDKCashuMintList,
    NDKEvent,
    NDKKind,
    NDKPrivateKeySigner,
    NDKRelay,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
import { NDKCashuToken } from '@nostr-dev-kit/ndk';
import { CashuWallet, type Proof } from '@cashu/cashu-ts';
import {
    parseAndValidateBackup,
    publishCashuMintList,
} from './cashu';
import currentUser from '$lib/stores/user';
import { walletBackup, unsavedProofsBackup } from '$lib/stores/wallet';
import { get } from 'svelte/store';

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

describe('cleanWallet', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.spyOn(CashuWallet.prototype, 'checkProofsSpent').mockImplementation(
            <T extends { secret: string }>(proofs: Array<T>): Promise<Array<T>> => {
                return Promise.resolve(
                    proofs.filter((proof) => {
                        const p = proof as unknown as Proof;
                        return p.id === 'spent proof';
                    })
                );
            }
        );

        vi.spyOn(NDKEvent.prototype, 'publish').mockImplementation(() => {
            return Promise.resolve(new Set<NDKRelay>());
        });

        vi.spyOn(NDKPrivateKeySigner.prototype, 'nip44Encrypt').mockImplementation(
            (recipient, value) => {
                return Promise.resolve(value);
            }
        );

        vi.spyOn(NDKCashuToken.prototype, 'publish').mockImplementation(() => {
            return Promise.resolve(new Set<NDKRelay>());
        });
    });

    test('should clean wallet from spent proofs', async () => {
        const mockNDK = new NDKSvelte();
        ndk.set(mockNDK);

        const signer = NDKPrivateKeySigner.generate();
        mockNDK.signer = signer;

        const user = await signer.user();
        currentUser.set(user);

        const cashuWallet = new NDKCashuWallet(mockNDK);

        // create 10 mock tokens, 3 of them should be treated as spent
        Array(10)
            .fill(0)
            .forEach((_, index) => {
                const token = new NDKCashuToken(mockNDK);
                token.id = `mock-token-${index}`;

                if (index % 2 === 0) {
                    token.mint = 'https://mock-mint1.cash';
                } else {
                    token.mint = 'https://mock-mint2.cash';
                }

                if (index % 4 === 0) {
                    token.proofs = [
                        {
                            id: 'spent proof',
                            amount: index,
                            secret: 'Mock secret',
                            C: 'Mock value',
                        },
                    ];
                } else {
                    token.proofs = [
                        {
                            id: 'mock proof id',
                            amount: index,
                            secret: 'Mock secret',
                            C: 'Mock value',
                        },
                    ];
                }

                cashuWallet.addToken(token);
            });

        await cleanWallet(cashuWallet);

        expect(cashuWallet.tokens.length).toEqual(7);
    });

    test('should clean wallet from duplicate proofs and create a new token', async () => {
        const mockNDK = new NDKSvelte();
        ndk.set(mockNDK);

        const signer = NDKPrivateKeySigner.generate();
        mockNDK.signer = signer;

        const user = await signer.user();
        currentUser.set(user);

        const cashuWallet = new NDKCashuWallet(mockNDK);

        // create 10 mock tokens, 3 of them should contain duplicate proofs
        Array(10)
            .fill(0)
            .forEach((_, index) => {
                const token = new NDKCashuToken();
                token.id = `mock-token-${index}`;

                if (index % 2 === 0) {
                    token.mint = 'https://mock-mint1.cash';
                } else {
                    token.mint = 'https://mock-mint2.cash';
                }

                if (index % 4 === 0) {
                    token.proofs = [
                        {
                            id: 'duplicate proof',
                            amount: 4,
                            secret: 'Mock secret',
                            C: 'Mock value',
                        },
                    ];
                } else {
                    token.proofs = [
                        {
                            id: 'mock proof id',
                            amount: index,
                            secret: 'Mock secret',
                            C: 'Mock value',
                        },
                    ];
                }

                cashuWallet.addToken(token);
            });

        await cleanWallet(cashuWallet);

        expect(cashuWallet.tokens.length).toEqual(8);
    });
});

describe('resyncWalletAndBackup', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.spyOn(CashuWallet.prototype, 'checkProofsSpent').mockImplementation((proofs) => {
            return Promise.resolve([]);
        });

        walletBackup.set(new Map());
        unsavedProofsBackup.set(new Map());
    });

    test('should add tokens to wallet that are stored in storage but not in wallet', async () => {
        const mockNDK = new NDKSvelte();
        ndk.set(mockNDK);

        const signer = NDKPrivateKeySigner.generate();
        mockNDK.signer = signer;

        const user = await signer.user();
        currentUser.set(user);

        const mockMint = 'https://mock-mint.cash';

        const mockCashuWallet = new NDKCashuWallet(mockNDK);

        const tokens = Array(5)
            .fill(0)
            .map((_, index) => {
                const token = new NDKCashuToken(mockNDK);
                token.proofs = [
                    {
                        id: 'mock proof id',
                        amount: 100 * ++index,
                        secret: 'Mock secret',
                        C: 'Mock value',
                    },
                ];
                token.mint = mockMint;

                token.wallet = mockCashuWallet;
                token.created_at = Math.floor(Date.now() / 1000);
                token.pubkey = user.pubkey;
                token.content = JSON.stringify({
                    proofs: token.proofs,
                });
                token.id = token.getEventHash();

                return token;
            });

        walletBackup.update((map) => {
            tokens.forEach((token) => map.set(token.id, token.rawEvent()));
            return map;
        });

        const $walletBackup = get(walletBackup);
        const $unsavedProofsBackup = get(unsavedProofsBackup);

        // before resyncing wallet should have no token
        expect(mockCashuWallet.tokens.length).toEqual(0);

        await resyncWalletAndBackup(mockCashuWallet, $walletBackup, $unsavedProofsBackup);

        expect(mockCashuWallet.tokens.length).toEqual(5);
    });

    test('should add tokens to backup that are available in wallet but in backup', async () => {
        const mockNDK = new NDKSvelte();
        ndk.set(mockNDK);

        const signer = NDKPrivateKeySigner.generate();
        mockNDK.signer = signer;

        const user = await signer.user();
        currentUser.set(user);

        const mockMint = 'https://mock-mint.cash';

        const mockCashuWallet = new NDKCashuWallet(mockNDK);

        Array(5)
            .fill(0)
            .forEach((_, index) => {
                const token = new NDKCashuToken(mockNDK);
                token.proofs = [
                    {
                        id: 'mock proof id',
                        amount: 100 * ++index,
                        secret: 'Mock secret',
                        C: 'Mock value',
                    },
                ];
                token.mint = mockMint;

                token.wallet = mockCashuWallet;
                token.created_at = Math.floor(Date.now() / 1000);
                token.pubkey = user.pubkey;
                token.content = JSON.stringify({
                    proofs: token.proofs,
                });
                token.id = token.getEventHash();

                mockCashuWallet.addToken(token);
            });

        const $walletBackup = get(walletBackup);
        const $unsavedProofsBackup = get(unsavedProofsBackup);

        // before resyncing backup should have no token
        expect($walletBackup.size).toEqual(0);

        await resyncWalletAndBackup(mockCashuWallet, $walletBackup, $unsavedProofsBackup);

        expect($walletBackup.size).toEqual(5);
    });

    test('should create a token from unsavedProofsBackup and add it to both tokens backup and wallet', async () => {
        const mockNDK = new NDKSvelte();
        ndk.set(mockNDK);

        const signer = NDKPrivateKeySigner.generate();
        mockNDK.signer = signer;

        const user = await signer.user();
        currentUser.set(user);

        const mockMint = 'https://mock-mint.cash';

        const mockCashuWallet = new NDKCashuWallet(mockNDK);

        const proofs = Array(5)
            .fill(0)
            .map((_, index) => ({
                id: 'mock proof id',
                amount: 100 * ++index,
                secret: 'Mock secret',
                C: 'Mock value',
            }));

        unsavedProofsBackup.update((map) => {
            map.set(mockMint, proofs);
            return map;
        });

        const $walletBackup = get(walletBackup);
        const $unsavedProofsBackup = get(unsavedProofsBackup);

        // before resyncing backup should have no token
        expect($walletBackup.size).toEqual(0);
        expect(mockCashuWallet.tokens.length).toEqual(0);

        await resyncWalletAndBackup(mockCashuWallet, $walletBackup, $unsavedProofsBackup);

        expect($walletBackup.size).toEqual(1);
        expect(mockCashuWallet.tokens.length).toEqual(1);
    });
});
