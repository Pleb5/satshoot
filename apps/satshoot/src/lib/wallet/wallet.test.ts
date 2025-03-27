import type { Proof } from '@cashu/cashu-ts';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuWallet, NDKWalletStatus } from '@nostr-dev-kit/ndk-wallet';
import { get } from 'svelte/store';

import {
    wallet,
    walletInit,
    walletStatus 
} from './wallet';

describe('walletStatus', () => {
    test('should be `INITIAL` by default', () => {
        expect(get(walletStatus)).toBe(NDKWalletStatus.INITIAL);
    });

    test('should be able to update wallet status', () => {
        walletStatus.set(NDKWalletStatus.READY);
        expect(get(walletStatus)).toBe(NDKWalletStatus.READY);
    });
});

describe('walletBackup', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('should be of size 0 by default', async () => {
        // Dynamically import the store after clearing localStorage
        const { walletBackup } = await import('./wallet');

        expect(get(walletBackup).size).toBe(0);
    });

    test('should also update local storage on updating store', async () => {
        // Dynamically import the store after clearing localStorage
        const { walletBackup } = await import('./wallet');

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

        walletBackup.update((map) => {
            map.set(mockMint1, mockProofs);
            map.set(mockMint2, mockProofs);
            return map;
        });

        const $walletBackup = get(walletBackup);

        expect($walletBackup.size).toEqual(2);
        expect($walletBackup.get(mockMint1)).toEqual(mockProofs);
        expect($walletBackup.get(mockMint2)).toEqual(mockProofs);
        expect(localStorage.getItem('walletBackup')).toEqual(stringified);
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
        localStorage.setItem('walletBackup', stringified);

        // Dynamically import the store after setting localStorage
        const { walletBackup } = await import('./wallet');

        const $walletBackup = get(walletBackup);

        expect(localStorage.getItem('walletBackup')).toEqual(stringified);
        expect($walletBackup.size).toEqual(2);
        expect($walletBackup.get(mockMint1)).toEqual(mockProofs);
        expect($walletBackup.get(mockMint2)).toEqual(mockProofs);
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

describe('walletInit', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize the wallet and update the store', async () => {
        const mockSubscribeForNutZaps = vi.fn(); // Mock implementation

        // Mock `start` method
        vi.spyOn(NDKWalletService.prototype, 'start').mockImplementation(() => {});

        const ndk = new NDKSvelte();
        const user = await NDKPrivateKeySigner.generate().user();

        // Call walletInit with mocked `subscribeForNutZaps`
        walletInit(ndk, user, mockSubscribeForNutZaps);

        // Assertions: Validate `ndkWalletService` initialization
        const $ndkWalletService = get(ndkWalletService);
        expect($ndkWalletService).toBeInstanceOf(NDKWalletService);

        // Emit `wallet:default` to simulate the wallet event
        const mockWallet = new NDKCashuWallet(ndk);
        $ndkWalletService?.emit('wallet:default', mockWallet);

        // Validate the `wallet` store
        const $wallet = get(wallet);
        expect($wallet).toBeDefined();
        expect($wallet).toBeInstanceOf(NDKCashuWallet);

        // Ensure `subscribeForNutZaps` was called
        expect(mockSubscribeForNutZaps).toHaveBeenCalledTimes(1);
        expect(mockSubscribeForNutZaps).toHaveBeenCalledWith(ndk, user, mockWallet);
    });
});
