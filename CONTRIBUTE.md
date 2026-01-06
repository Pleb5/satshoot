# Contributing

## Development setup

SatShoot is a `pnpm` + Turborepo monorepo. It includes `packages/ndk-wallet` as a git submodule.

### Prerequisites

- Node.js (recommended: current LTS)
- `corepack` (bundled with Node) for managing the pinned `pnpm` version
- Optional: `just` (quality-of-life scripts)
- Optional: Nix devshell (`flake.nix`)

### Clone

Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/Pleb5/satshoot.git
cd satshoot
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

### Install dependencies

Use the repo-pinned `pnpm` via Corepack:

```bash
corepack enable
corepack prepare pnpm@9.7.0 --activate
pnpm i
```

### Run the app

From the repo root:

```bash
pnpm dev
```

### Build

Builds `packages/ndk-wallet` first (via `./ndk_compile.sh`), then runs the Turbo build:

```bash
pnpm build
```

### Tests

Run all workspace tests:

```bash
pnpm -r test
```

Or run per-package:

```bash
pnpm -C apps/satshoot test
pnpm -C packages/ndk-wallet test
```

### Nix

If you use Nix:

```bash
nix develop
```

### Troubleshooting

- If you change files under `packages/ndk-wallet`, restart the dev server.
- If `packages/ndk-wallet` is missing or empty, re-run `git submodule update --init --recursive`.
- Clean reinstall (requires `just`): `just renew`.

### Working with the upstream `ndk-wallet`

If you want to pull in changes from upstream, add a second remote inside the submodule:

```bash
cd packages/ndk-wallet
git remote add upstream https://github.com/rodant/ndk-wallet.git
git fetch upstream
```
