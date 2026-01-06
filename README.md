# SatShoot

Nostr-native freelancing marketplace (PWA): post jobs, offer services, chat, pay in sats, and build a portable reputation.

- Live: https://satshoot.com

## What it does

- **Jobs & bidding**: clients post jobs (RFQs), freelancers bid with fixed or time-based offers.
- **Services & orders**: freelancers list services; clients can place orders.
- **Chat & notifications**: Nostr DMs + a service worker for notifications.
- **Payments**: Lightning zaps (NIP-57) and Cashu ecash wallets (NIP-60 / nutzaps); optional Nostr Wallet Connect (NIP-47).
- **Anti-spam**: relay selection + outbox model (NIP-65) and Web-of-Trust oriented UX.

## Protocol / event kinds

SatShoot models freelancing primitives as custom Nostr event kinds:

- `32765` Freelance Service
- `32766` Freelance Order
- `32767` Freelance Job
- `32768` Freelance Bid
- `1986` Review
- `967` Kind-scoped follow

See `EVENT_STRUCTURE.md` for the full tag/content schemas.

## Tech stack

- `apps/satshoot`: SvelteKit (static adapter) + Vite + TypeScript + Tailwind/Skeleton
- Nostr client: `@nostr-dev-kit/ndk` (+ `ndk-svelte` helpers)
- Wallet toolkit (vendored): `packages/ndk-wallet` (git submodule, used via workspace dependency)

## Development

1. Clone with submodules:
   - `git clone --recurse-submodules <repo-url>`
1. Enable the repo-pinned `pnpm` (recommended):
   - `corepack enable && corepack prepare pnpm@9.7.0 --activate`
1. Install dependencies:
   - `pnpm i`
1. Run the app:
   - `pnpm dev`

Useful scripts from the repo root:

- Build: `pnpm build` (builds `packages/ndk-wallet` first, then Turbo build)
- Preview: `pnpm preview`
- Tests: `pnpm -r test`
- Clean reinstall: `just renew`

If you use Nix, a devshell is provided via `flake.nix`:

- `nix develop`

## Contributing

See `CONTRIBUTE.md` and `CHANGELOG.md`.

## License

MIT (see `apps/satshoot/LICENSE`; `packages/ndk-wallet` declares MIT in `packages/ndk-wallet/package.json`).
