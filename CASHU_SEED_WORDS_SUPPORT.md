# Second Iteration Toward NUT-13 Support in SatShoot
After implementing the basic seed-handling functions in `nut-13.ts` and the initial user flows in `MnemonicSeedGenerationModal.svelte` and `MnemonicSeedInputModal.svelte`, our next goal is to build a robust framework for durable Nostr-native wallet seed support in the `ndk-wallet` package.

To achieve this, we first introduce the Nostr Wallet Seed event.

## New Deterministic Cashu Wallet Event in the ndk-wallet Package
For deterministic Cashu proofs, the `ndk-wallet` must track, for every mint and keyset, a counter that represents the last used value, starting at zero. This part of the wallet state must be stored on the Nostr network via a new Nostr event (wallet seed event) with the following structure:

### Protocol Extension
This new event kind will be proposed as an extension of NIP-60:
```json
{
    "kind": 17376,
    "content": nip44_encrypt({
        "bip39seed": "hexkey",
        "counters": {
            "<normalized-mint1-url>|<keyset=keyset-id-1>": "<counter-1>",
            "<normalized-mint1-url>|<keyset=keyset-id-2>": "<counter-2>",
            "<normalized-mint2-url>|<keyset=keyset-id-3>": "<counter-3>",
        }
    }),
    "tags": [],
    ...
}
```

This extension provides the foundation for the second iteration toward NUT-13 support in SatShoot.

### Implementation Tasks Breakdown for ndk-wallet
* Clients can pass a Deterministic Wallet Event (kind `17376`) to an existing `NDKCashuWallet` to set the BIP-39 seed and corresponding mint counter information in `WalletState`.
* The counter information in kind `17376` must also be stored within the `ndk-wallet` classes:
  * The wallet seed is stored in the `NDKCashuWallet` class (`_bip39seed`).
  * The current counter state for all wallet mints is stored in the `WalletState` class.
* The counter state must be accessible wherever new proofs are generated. The counter value should be passed to the `cashu-ts` wallet functions to derive the next secret.
* After generating a proof, the wallet seed event must be updated with the counter incremented by one for the relevant mint and keyset ID. This mirrors how the new proofs are published in `ndk-wallet`, and the internal wallet state must be updated immediately.

## Second Iteration in SatShoot
### Implementation Tasks Breakdown
* Upon login, the application must load event kind `17376` along with the Cashu wallet event (kind `17375`).
  * If neither event `17375` nor `17376` is loaded, prompt the user to create the Nostr Cashu wallet with a BIP-39 seed, as partially implemented in `my-cashu-wallet/+page.svelte`.
  * If the application cannot load event kind `17376` but finds a `17375` (legacy scenario), continue with the existing behavior; do not set the seed in `NDKCashuWallet`, and ignore the new logic described above.
