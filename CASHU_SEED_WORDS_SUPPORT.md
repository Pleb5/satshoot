# Second Iteration towards NUT-13 support in Satshoot
After implementing some basic functions for seed handling in nut-13.ts and first user UI flows in the modals MnemonicSeedGenerationModal.svelte and MnemonicSeedInputModal for setting up and initializing the wallet, now we want to implement a solid framework for durable Nostr native wallet seed support in the ndk-wallet package.

For this purpose we introduce the Nostr Wallet Seed Event first.

## New Deterministic Cashu Wallet Event in ndk-wallet Package
For deterministic Cashu proofs the ndk-wallet must track for every mint and keyset a counter representing the last used value starting by zero. This part of the wallet state must be store in the Nostr network through a new Nostr event (wallet seed event) with the following structure:

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

This ndk-wallet extension is the ground for the second iteration towards NUT-13 support in Satshoot.

### Implementation Tasks Breakdown for ndk-wallet
* Clients can pass a Deterministic Wallet Event (kind 17376) to a existing NDKCashuWallet to set the bip39seed and the mint counter information in the WalletState.
* The counter information in kind 17376 must be store in the ndk-wallet classes as well.
  * The wallet seed gets stored in the NDKCashuWallet class (_bip39seed).
  * The current counter state for all wallet's mints must be stored in the WalletState class.
* This counter state must be made available at different places where new proofs are created. The counter value must be passed to the cashu-ts wallet functions to generate the next secret.
* After that the wallet seed event must be updated with the new counter incremented by one for the used mint and keyset-id. This is done similarly to how the new proofs are published in ndk-wallet. The internal wallet state must be updated immediately.

## Second Iteration in Satshoot
### Implementation Tasks Breakdown
* Upon login the application must load this event kind (17376) along with the Cashu wallet event (kind 17375).
  * If non of the events 17375 and 17376 are loaded, the user must be prompted to create the Nostr Cashu Wallet with BIP-39 seed as already partly implemented in my-cashu-wallet/+page.svelte.
  * If the app can't load any event kind 17376 but a 17375 is found (legacy case), we proceed as before implementing this feature. No seed is set in the NDKCashuWallet and the new logic described bellow doesn't apply.