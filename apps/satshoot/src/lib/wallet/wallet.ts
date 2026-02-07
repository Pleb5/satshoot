import { NDKCashuMintList, NDKUser } from '@nostr-dev-kit/ndk';
import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { NDKCashuWallet, NDKNutzapMonitor, NDKWalletStatus } from '@nostr-dev-kit/ndk-wallet';
import { get, writable } from 'svelte/store';
import { getEncodedTokenV4, type Proof } from '@cashu/cashu-ts';

import currentUser from '$lib/stores/user';

export const wallet = writable<NDKCashuWallet | null>(null);
export let userCashuInfo = writable<NDKCashuMintList | null>(null);
export let ndkNutzapMonitor: NDKNutzapMonitor | null = null;

export const walletStatus = writable<NDKWalletStatus>(NDKWalletStatus.INITIAL);
export const walletDecryptFailed = writable(false);

const WALLET_READY_TIMEOUT_MS = 8000;

export async function walletInit(
  ndkWallet: NDKCashuWallet,
  mintList: NDKCashuMintList,
  ndk: NDKSvelte,
  user: NDKUser,
  oldNDKWallet?: NDKCashuWallet
): Promise<boolean> {
  const initPubkey = user.pubkey;
  const isStale = () => {
    const activeUser = get(currentUser);
    return !activeUser || activeUser.pubkey !== initPubkey;
  };

  if (isStale()) return false;

  if (!ndkWallet._p2pk) {
    await ndkWallet.getP2pk();
    if (isStale()) return false;
  }

  let deterministicTransfer = false;
  if (oldNDKWallet) {
    deterministicTransfer = await transferAllFundsTo(oldNDKWallet, ndkWallet);
    if (isStale()) return false;
  }

  wallet.set(ndkWallet);
  userCashuInfo.set(mintList);

  let walletReadyTimeoutId: ReturnType<typeof setTimeout> | undefined;
  ndkWallet.on('ready', async () => {
    if (isStale()) return;
    if (walletReadyTimeoutId) clearTimeout(walletReadyTimeoutId);
    walletStatus.set(NDKWalletStatus.READY);

    ndkNutzapMonitor = new NDKNutzapMonitor(ndk, user, { mintList });
    ndkNutzapMonitor.wallet = ndkWallet;

    ndkNutzapMonitor.start({
      filter: { limit: 100 },
      opts: { skipVerification: true },
    });
  });

  walletReadyTimeoutId = setTimeout(() => {
    if (isStale()) return;
    if (get(walletStatus) !== NDKWalletStatus.READY) {
      console.warn('Wallet ready timed out, continuing with limited data.');
      walletStatus.set(NDKWalletStatus.READY);
    }
  }, WALLET_READY_TIMEOUT_MS);

  try {
    ndkWallet.start({ subId: 'wallet', pubkey: user.pubkey });
  } catch (error) {
    if (!isStale()) {
      console.warn('Failed to start wallet relay subscriptions.', error);
      walletStatus.set(NDKWalletStatus.READY);
    }
  }

  return deterministicTransfer;
}

export type TransferFundsOps = {
  skipConsolidation?: boolean,
  transferMints?: string | string[]
}

/**
 * Transfers all the funds from one wallet to another. All the mints having a positive amount (or the ops.transferMints if specified) must be a mint of the receiving wallet, otherwise an error is thrown.
 * @param sourceNDKWallet the source of the funds.
 * @param receivingNDKWallet the wallet receiving the funds. This wallet must not be a deterministic one.
 * @param ops optional options to customize the operation.
 * @returns true if the funds are secured by deterministic secrets after the transfer.
 */
export async function transferAllFundsTo(sourceNDKWallet: NDKCashuWallet, receivingNDKWallet: NDKCashuWallet, ops?: TransferFundsOps): Promise<boolean> {
  if (!ops?.skipConsolidation) {
    await sourceNDKWallet.consolidateTokens();
  }
  const mintBalances = sourceNDKWallet.mintBalances;
  const mintKeys = Object.keys(mintBalances);
  const mints = ops?.transferMints ? mintKeys.filter(m => ops.transferMints?.includes(m)) : mintKeys;
  let deterministicTransfer = !!receivingNDKWallet.bip39seed;
  for (const mint of mints) {
    if (!receivingNDKWallet.mints.includes(mint)) {
      throw new Error(`Precondition violated: every sending mint (${mint}) must be a mint of the receiving wallet too!`);
    }
    const proofs = sourceNDKWallet.state.getProofs({ mint: mint, onlyAvailable: true });
    if (proofs.length) {
      let receivedProofs: Proof[];
      try {
        const token = getEncodedTokenV4({ mint, proofs });
        const receivingWallet = await receivingNDKWallet.getCashuWallet(mint, receivingNDKWallet.bip39seed);
        const currentCounterEntry = await receivingNDKWallet.state.getCounterEntryFor(receivingWallet.mint);
        const counter = receivingNDKWallet.bip39seed ? currentCounterEntry.counter ?? 1 : undefined;//cashu-ts 2.7.4 ignores counter == 0!
        receivedProofs = await receivingWallet.receive(token, { counter });
        if (receivingNDKWallet.bip39seed && receivedProofs.length) {
          const counterIncrement = counter == 1 ? receivedProofs.length + 1 : receivedProofs.length;
          await receivingNDKWallet.incrementDeterministicCounter(currentCounterEntry.counterKey, counterIncrement, false);
        }
      } catch (e) {
        console.error(
          `Error while transferring funds to new wallet for mint ${mint}. The funds will be stored in the new wallet, but without deterministic secrets!`,
          e
        );
        if (e instanceof Error && e.cause) {
          console.error('Transfer error cause:', e.cause);
        }
        console.error(
          "To ensure all the funds are secured by deterministic secrets, please retry by transferring all funds again with this method, or send the e-Cash to yourself."
        );
        receivedProofs = proofs;
        deterministicTransfer = false;
      }

      for (const proof of receivedProofs) {
        receivingNDKWallet.state.addProof({ mint, proof, state: "available", timestamp: Date.now() });
      }

    }
  }
  return deterministicTransfer;
}
