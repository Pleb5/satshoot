import { get } from 'svelte/store';
import { WalletStatus, walletStatus } from './wallet';
import type { Proof } from '@cashu/cashu-ts';

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

    afterEach(() => {
        vi.restoreAllMocks();
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
