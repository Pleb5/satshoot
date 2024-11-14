import { get } from 'svelte/store';
import { walletInit, WalletStatus, walletStatus } from './wallet';
import type { Proof } from '@cashu/cashu-ts';
import { NDKPrivateKeySigner, NDKRelaySet, NDKUser, type NostrEvent } from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import NDKWalletService, { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';

describe('walletStatus', () => {
    test('should be `loading` by default', () => {
        expect(get(walletStatus)).toBe(WalletStatus.Loading);
    });

    test('should be able to update wallet status', () => {
        walletStatus.set(WalletStatus.Loaded);
        expect(get(walletStatus)).toBe(WalletStatus.Loaded);
    });
});

describe('unsavedProofsBackup', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('should be of size 0 by default', async () => {
        // Dynamically import the store after clearing localStorage
        const { unsavedProofsBackup } = await import('./wallet');

        expect(get(unsavedProofsBackup).size).toBe(0);
    });

    test('should also update local storage on updating store', async () => {
        // Dynamically import the store after clearing localStorage
        const { unsavedProofsBackup } = await import('./wallet');

        const mockProofs: Proof[] = [
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
        const mockMint1 = 'wss://mock-mint-1.com';
        const mockMint2 = 'wss://mock-mint-2.com';
        const stringified = JSON.stringify([
            [mockMint1, mockProofs],
            [mockMint2, mockProofs],
        ]);

        unsavedProofsBackup.update((map) => {
            map.set(mockMint1, mockProofs);
            map.set(mockMint2, mockProofs);
            return map;
        });

        const $unsavedProofsBackup = get(unsavedProofsBackup);

        expect($unsavedProofsBackup.size).toEqual(2);
        expect($unsavedProofsBackup.get(mockMint1)).toEqual(mockProofs);
        expect($unsavedProofsBackup.get(mockMint2)).toEqual(mockProofs);
        expect(localStorage.getItem('unsavedProofsBackup')).toEqual(stringified);
    });

    test('should load with existing value in local storage', async () => {
        const mockProofs: Proof[] = [
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
        const mockMint1 = 'wss://mock-mint-1.com';
        const mockMint2 = 'wss://mock-mint-2.com';
        const stringified = JSON.stringify([
            [mockMint1, mockProofs],
            [mockMint2, mockProofs],
        ]);
        localStorage.setItem('unsavedProofsBackup', stringified);

        // Dynamically import the store after setting localStorage
        const { unsavedProofsBackup } = await import('./wallet');

        const $unsavedProofsBackup = get(unsavedProofsBackup);

        expect(localStorage.getItem('unsavedProofsBackup')).toEqual(stringified);
        expect($unsavedProofsBackup.size).toEqual(2);
        expect($unsavedProofsBackup.get(mockMint1)).toEqual(mockProofs);
        expect($unsavedProofsBackup.get(mockMint2)).toEqual(mockProofs);
    });
});

describe('cashuTokensBackup', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('should be of size 0 by default', async () => {
        // Dynamically import the store after clearing localStorage
        const { cashuTokensBackup } = await import('./wallet');

        expect(get(cashuTokensBackup).size).toBe(0);
    });

    test('should also update local storage on updating store', async () => {
        // Dynamically import the store after clearing localStorage
        const { cashuTokensBackup } = await import('./wallet');

        const mockEvents: NostrEvent[] = [
            {
                created_at: Math.floor(Date.now() / 1000),
                content: 'string',
                tags: [],
                kind: 0,
                pubkey: 'dummy pubkey',
            },
            {
                created_at: Math.floor(Date.now() / 1000),
                content: 'string',
                tags: [],
                kind: 0,
                pubkey: 'dummy pubkey',
            },
            {
                created_at: Math.floor(Date.now() / 1000),
                content: 'string',
                tags: [],
                kind: 0,
                pubkey: 'dummy pubkey',
            },
        ];
        const mockEventId1 = 'mock-event-id-1';
        const mockEventId2 = 'mock-event-id-2';
        const stringified = JSON.stringify([
            [mockEventId1, mockEvents[0]],
            [mockEventId2, mockEvents[1]],
        ]);

        cashuTokensBackup.update((map) => {
            map.set(mockEventId1, mockEvents[0]);
            map.set(mockEventId2, mockEvents[1]);
            return map;
        });

        const $cashuTokensBackup = get(cashuTokensBackup);

        expect($cashuTokensBackup.size).toEqual(2);
        expect($cashuTokensBackup.get(mockEventId1)).toEqual(mockEvents[0]);
        expect($cashuTokensBackup.get(mockEventId2)).toEqual(mockEvents[1]);
        expect(localStorage.getItem('cashuTokensBackup')).toEqual(stringified);
    });

    test('should load with existing value in local storage', async () => {
        const mockEvents: NostrEvent[] = [
            {
                created_at: Math.floor(Date.now() / 1000),
                content: 'string',
                tags: [],
                kind: 0,
                pubkey: 'dummy pubkey',
            },
            {
                created_at: Math.floor(Date.now() / 1000),
                content: 'string',
                tags: [],
                kind: 0,
                pubkey: 'dummy pubkey',
            },
            {
                created_at: Math.floor(Date.now() / 1000),
                content: 'string',
                tags: [],
                kind: 0,
                pubkey: 'dummy pubkey',
            },
        ];
        const mockEventId1 = 'mock-event-id-1';
        const mockEventId2 = 'mock-event-id-2';
        const stringified = JSON.stringify([
            [mockEventId1, mockEvents[0]],
            [mockEventId2, mockEvents[1]],
        ]);

        localStorage.setItem('cashuTokensBackup', stringified);

        // Dynamically import the store after setting localStorage
        const { cashuTokensBackup } = await import('./wallet');

        const $cashuTokensBackup = get(cashuTokensBackup);

        expect(localStorage.getItem('cashuTokensBackup')).toEqual(stringified);
        expect($cashuTokensBackup.size).toEqual(2);
        expect($cashuTokensBackup.get(mockEventId1)).toEqual(mockEvents[0]);
        expect($cashuTokensBackup.get(mockEventId2)).toEqual(mockEvents[1]);
    });
});

describe('ndkWalletService', () => {
    test('should be an instance of NDKWalletService', async () => {
        const ndk = new NDKSvelte();
        const user = await NDKPrivateKeySigner.generate().user();
        walletInit(ndk, user);

        const { ndkWalletService } = await import('./wallet');

        expect(get(ndkWalletService)).toBeInstanceOf(NDKWalletService);
    });
});
