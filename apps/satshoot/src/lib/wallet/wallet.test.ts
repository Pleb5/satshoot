import type { Proof } from '@cashu/cashu-ts';
import { NDKCashuMintList, NDKPrivateKeySigner, NDKRelaySet } from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuWallet, NDKWalletStatus } from '@nostr-dev-kit/ndk-wallet';
import { get } from 'svelte/store';

import { wallet, walletInit, walletStatus } from './wallet';
import { serializeWallet, WALLET_BACKUP_VERSION, type WalletStorage } from './cashu';
import { DEFAULTRELAYURLS } from '$lib/stores/ndk';

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

    test('should be null by default', async () => {
        // Dynamically import the store after clearing localStorage
        const { walletBackup } = await import('./wallet');

        expect(get(walletBackup)).toBeNull();
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

        const ws: WalletStorage = {
            version: WALLET_BACKUP_VERSION,
            cashuKeys: {},
            mintsWithProofs: {
                [mockMint1]: mockProofs,
                [mockMint2]: mockProofs,
            },
        };

        walletBackup.set(ws);
        const serializedWallet = serializeWallet(ws);

        const $walletBackup = get(walletBackup);

        expect(Object.entries($walletBackup?.mintsWithProofs || {}).length).toEqual(2);
        expect($walletBackup?.mintsWithProofs[mockMint1]).toEqual(mockProofs);
        expect($walletBackup?.mintsWithProofs[mockMint2]).toEqual(mockProofs);
        expect(localStorage.getItem('walletBackup')).toEqual(serializedWallet);
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

        const ws: WalletStorage = {
            version: WALLET_BACKUP_VERSION,
            cashuKeys: {},
            mintsWithProofs: {
                [mockMint1]: mockProofs,
                [mockMint2]: mockProofs,
            },
        };

        const serializedWallet = serializeWallet(ws);

        localStorage.setItem('walletBackup', serializedWallet);

        // Dynamically import the store after setting localStorage
        const { walletBackup } = await import('./wallet');

        const $walletBackup = get(walletBackup);

        expect(localStorage.getItem('walletBackup')).toEqual(serializedWallet);
        expect(Object.entries($walletBackup?.mintsWithProofs || {}).length).toEqual(2);
        expect($walletBackup?.mintsWithProofs[mockMint1]).toEqual(mockProofs);
        expect($walletBackup?.mintsWithProofs[mockMint2]).toEqual(mockProofs);
    });
});

describe('walletInit', () => {
    it('should initialize the wallet and update the store', async () => {
        const ndk = new NDKSvelte();
        const user = await NDKPrivateKeySigner.generate().user();

        const newWallet = new NDKCashuWallet(ndk);
        await newWallet.getP2pk();
        newWallet.relaySet = NDKRelaySet.fromRelayUrls(DEFAULTRELAYURLS, ndk);
        // todo: set mints

        const cashuInfo = new NDKCashuMintList(ndk);
        cashuInfo.p2pk = newWallet._p2pk;
        cashuInfo.relays = DEFAULTRELAYURLS;
        cashuInfo.mints = newWallet.mints;

        walletInit(newWallet, cashuInfo, ndk, user);

        // Validate the `wallet` store
        const $wallet = get(wallet);
        expect($wallet).toBeDefined();
        expect($wallet).toBeInstanceOf(NDKCashuWallet);
    });
});
