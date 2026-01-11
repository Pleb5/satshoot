# SatShoot
A nostr-based freelance marketplace for freedom lovers.

Try it live on:
```
https://satshoot.com
```

## Benefits
- No middle-man: your nostr keys, your contacts, your deals.
- Your servers: respects your relays of choice (see [outbox model](https://nostr-nips.com/nip-65)).
- Web of Trust (WoT): uses your nostr-based social network to fight scammers, spammers, and irrelevant people.
- Build an unstoppable reputation on nostr as a freelancer.

## Typical Flow
- Clients post any kind of job or problem (a Request For Quote).
- Freelancers bid on jobs with offers (absolute or time-based).
- Clients select the most attractive offer (price + reputation).
- Work begins via any communication channel, defaulting to nostr DMs (NIP-04).
- Payments happen after agreement, followed by mutual reviews.
- Reputation builds from public zaps and public reviews.
- Share jobs or services through your nostr feed.

## Tech Stack
- Frontend: SvelteKit (Svelte 5 + Vite) in `apps/satshoot`.
- Wallet/lib: `@nostr-dev-kit/ndk-wallet` in `packages/ndk-wallet`.
- Build orchestration: `turbo`, package management with `pnpm`.

## Quick Start
```bash
pnpm i
pnpm run dev
```

If you cloned without submodules, initialize the wallet submodule:
```bash
git submodule update --init --recursive
```

## Common Commands
- Dev (all packages): `pnpm run dev`.
- Build (all): `pnpm run build` (runs `./ndk_compile.sh` then `turbo run build`).
- Preview (all): `pnpm run preview`.
- App dev only: `pnpm --filter satshoot dev`.
- Wallet dev only: `pnpm --filter @nostr-dev-kit/ndk-wallet dev`.

## Tests
- App (Vitest): `pnpm --filter satshoot test`.
- Wallet (Jest): `pnpm --filter @nostr-dev-kit/ndk-wallet test`.
- Single Vitest file: `pnpm --filter satshoot test -- --run src/lib/wallet/wallet.test.ts`.
- Single Jest file: `pnpm --filter @nostr-dev-kit/ndk-wallet test -- src/utils/cashu.test.ts`.

## Contributing
See `CONTRIBUTE.md` for setup, linting, and workflow details.

- Built with [Nostr Development Kit](https://github.com/nostr-dev-kit/ndk) by @[pablof7z](https://github.com/pablof7z).
