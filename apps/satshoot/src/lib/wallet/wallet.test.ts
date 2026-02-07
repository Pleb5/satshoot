import { NDKCashuMintList, NDKPrivateKeySigner, NDKRelaySet } from '@nostr-dev-kit/ndk';
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuWallet, NDKWalletStatus } from '@nostr-dev-kit/ndk-wallet';
import { get } from 'svelte/store';

import { wallet, walletInit, walletStatus } from './wallet';
import { DEFAULTRELAYURLS } from '$lib/stores/session';
import currentUser from '$lib/stores/user';

describe('walletStatus', () => {
  test('should be `INITIAL` by default', () => {
    expect(get(walletStatus)).toBe(NDKWalletStatus.INITIAL);
  });

  test('should be able to update wallet status', () => {
    walletStatus.set(NDKWalletStatus.READY);
    expect(get(walletStatus)).toBe(NDKWalletStatus.READY);
  });
});


describe('walletInit', () => {
  it('should initialize the wallet and update the store', async () => {
    const ndk = new NDKSvelte();
    const user = await NDKPrivateKeySigner.generate().user();
    currentUser.set(user);

    const newWallet = new NDKCashuWallet(ndk);
    await newWallet.getP2pk();
    newWallet.relaySet = NDKRelaySet.fromRelayUrls(DEFAULTRELAYURLS, ndk);
    // todo: set mints

    const cashuInfo = new NDKCashuMintList(ndk);
    cashuInfo.p2pk = newWallet._p2pk;
    cashuInfo.relays = DEFAULTRELAYURLS;
    cashuInfo.mints = newWallet.mints;

    await walletInit(newWallet, cashuInfo, ndk, user);

    // Validate the `wallet` store
    const $wallet = get(wallet);
    expect($wallet).toBeDefined();
    expect($wallet).toBeInstanceOf(NDKCashuWallet);

    currentUser.set(null);
  });
});
