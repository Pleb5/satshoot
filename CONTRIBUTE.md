# Contributing to SatShoot

## Prerequisites
- [pnpm](https://pnpm.io/)
- [Turbo Repo](https://turbo.build/repo)
- [Just](https://github.com/casey/just) (optional helper)

If you prefer global installs:
```bash
npm install -g pnpm turbo just
```

## Clone the Repository
Clone with the ndk-wallet submodule:
```bash
git clone --recurse-submodules https://github.com/Pleb5/satshoot.git
```

If you already cloned without submodules:
```bash
git submodule update --init --recursive
```

## Install Dependencies
From the repo root:
```bash
pnpm i
```

## Development
Run everything:
```bash
pnpm run dev
```

Run only the app:
```bash
pnpm --filter satshoot dev
```

Run only the wallet package:
```bash
pnpm --filter @nostr-dev-kit/ndk-wallet dev
```

If you change the wallet package, restart the Vite dev server so the app reloads it.

## Build & Preview
- Build all: `pnpm run build` (runs `./ndk_compile.sh` then `turbo run build`).
- Preview all: `pnpm run preview`.
- Clean wallet build: `pnpm --filter @nostr-dev-kit/ndk-wallet clean`.

## Typecheck & Lint
- App typecheck: `pnpm --filter satshoot check`.
- Wallet lint: `pnpm --filter @nostr-dev-kit/ndk-wallet lint`.
- Wallet format: `pnpm --filter @nostr-dev-kit/ndk-wallet format`.

## Tests
- App tests (Vitest): `pnpm --filter satshoot test`.
- Wallet tests (Jest): `pnpm --filter @nostr-dev-kit/ndk-wallet test`.

### Running a Single Test
- Vitest file: `pnpm --filter satshoot test -- --run src/lib/wallet/wallet.test.ts`.
- Vitest by name: `pnpm --filter satshoot test -- -t "test name"`.
- Jest file: `pnpm --filter @nostr-dev-kit/ndk-wallet test -- src/utils/cashu.test.ts`.
- Jest by name: `pnpm --filter @nostr-dev-kit/ndk-wallet test -- -t "test name"`.

## Clean Reinstall
`just renew` wipes lockfiles and `node_modules` before reinstalling. Use carefully.

## Working With the NDK Wallet Upstream
If you want to pull in changes from the original wallet repo, add a remote:
```bash
git remote add original_ndk https://github.com/rodant/ndk-wallet.git
```
Fetch and merge from `original_ndk`, then push to your fork as needed.

## AI-Assisted Workflow Guidance
- Read `AGENTS.md` before editing; follow formatting rules per package.
- Prefer small, focused diffs with clear commit intent.
- Use `pnpm --filter` for package-specific tasks to save time.
- Run the closest relevant tests when changing behavior.
- Avoid committing generated artifacts (`apps/satshoot/build`, `packages/ndk-wallet/dist`).
- Use `import type` for type-only imports in TypeScript.
- Keep errors explicit (`throw new Error('message')`) and log actionable retries.
- If a command could be destructive (e.g., `just renew`), call it out before running.
