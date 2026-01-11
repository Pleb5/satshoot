# SatShoot Agent Guide

## Scope
- Applies to the entire repository unless a deeper `AGENTS.md` exists.

## Repository Layout
- `apps/satshoot`: SvelteKit frontend (Svelte 5 + Vite).
- `packages/ndk-wallet`: TypeScript library used by the app.
- `packages/ndk-wallet/packages/eslint-config-custom`: shared ESLint config.
- `packages/ndk-wallet/packages/tsconfig`: shared TS configs.
- `justfile`: helper automation for builds/cleanup.
- `ndk_compile.sh`: native build step used by root build.

## Tooling Notes
- Package manager: `pnpm` (see root `package.json`).
- Task runner: `turbo` (see `turbo.json`).
- Optional helpers: `just` (see `justfile`).
- Submodule hint: see `CONTRIBUTE.md` for ndk-wallet submodule tips.

## Setup Notes
- Global tools mentioned in `CONTRIBUTE.md`: `pnpm`, `turbo`, `just`.
- `pnpm i` installs workspace deps from the repo root.
- `just renew` wipes lockfiles and `node_modules` before reinstalling.

## Build / Dev Commands
- Install deps: `pnpm i` (from repo root).
- Dev (all packages): `pnpm run dev`.
- Build (all): `pnpm run build` (runs `./ndk_compile.sh` then `turbo run build`).
- Preview (all): `pnpm run preview`.

## Package-Specific Commands
- App dev: `pnpm --filter satshoot dev`.
- App build: `pnpm --filter satshoot build`.
- App preview: `pnpm --filter satshoot preview`.
- App typecheck: `pnpm --filter satshoot check`.

- Wallet dev: `pnpm --filter @nostr-dev-kit/ndk-wallet dev`.
- Wallet build: `pnpm --filter @nostr-dev-kit/ndk-wallet build`.
- Wallet clean: `pnpm --filter @nostr-dev-kit/ndk-wallet clean`.
- Wallet lint: `pnpm --filter @nostr-dev-kit/ndk-wallet lint`.
- Wallet format: `pnpm --filter @nostr-dev-kit/ndk-wallet format`.

## Script Details
### Root (`package.json`)
- `build`: `./ndk_compile.sh && turbo run build`.
- `dev`: `turbo run dev`.
- `preview`: `turbo run preview`.

### App (`apps/satshoot/package.json`)
- `dev`: `vite dev --host 0.0.0.0`.
- `build`: `vite build`.
- `preview`: `vite preview`.
- `check`: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`.
- `check:watch`: runs check in watch mode.
- `serve`: `vite build` then `npx http-server ./build/htdocs/`.
- `test`: `vitest`.

### Wallet (`packages/ndk-wallet/package.json`)
- `dev`: `pnpm build --watch`.
- `build`: `tsup src/index.ts --format cjs,esm --dts`.
- `clean`: `rm -rf dist`.
- `test`: `jest`.
- `lint`: `prettier --check . && eslint .`.
- `format`: `prettier --write .`.

## Turbo Task Behavior
- `build` depends on ancestor builds and outputs `dist/**`.
- `dev` and `preview` are persistent and uncached.
- `clean` runs without cache.

## Tests
- App tests: `pnpm --filter satshoot test` (Vitest).
- Wallet tests: `pnpm --filter @nostr-dev-kit/ndk-wallet test` (Jest).

### Running a Single Test
- Vitest file: `pnpm --filter satshoot test -- --run src/lib/wallet/wallet.test.ts`.
- Vitest by name: `pnpm --filter satshoot test -- -t "test name"`.
- Jest file: `pnpm --filter @nostr-dev-kit/ndk-wallet test -- src/utils/cashu.test.ts`.
- Jest by name: `pnpm --filter @nostr-dev-kit/ndk-wallet test -- -t "test name"`.

## Justfile Helpers
- `just build`: turbo build.
- `just compile-ndk`: run `./ndk_compile.sh`.
- `just renew`: wipe lockfiles/node_modules and reinstall (see `justfile`).

## Formatting & Linting Rules
### Svelte App (`apps/satshoot`)
- Prettier config in `apps/satshoot/.prettierrc`.
- Indentation: 4 spaces, no tabs.
- Quotes: single quotes.
- Semicolons: required.
- Trailing commas: `es5`.
- Print width: 100.
- Svelte files use the Svelte parser with the same settings.

### NDK Wallet (`packages/ndk-wallet`)
- Linting via `@nostr-dev-kit/eslint-config-custom`.
- ESLint extends `eslint:recommended`, `@typescript-eslint/recommended`, `prettier`.
- Semicolons required (`semi: ["error", "always"]`).
- Type-only imports enforced (`@typescript-eslint/consistent-type-imports`).
- Unused vars warn; unused args allowed.
- Prettier uses defaults (no local config); expect double quotes unless otherwise configured.

## TypeScript Expectations
- Strict TS is enabled in both the app and wallet configs.
- Prefer explicit typing for public APIs and exported helpers.
- Use `import type { ... }` for type-only imports.
- Keep `noUnchecked` style changes consistent with existing tsconfig.

## Svelte/SvelteKit Conventions
- Use Svelte 5 runes syntax as found in the app (e.g. `$state`, `$derived`).
- Use `$lib` alias for app-level imports (see `src/lib`).
- Keep route files under `apps/satshoot/src/routes` with SvelteKit conventions.

## Naming Conventions
- Components: `PascalCase.svelte` (see `src/lib/components/*`).
- Stores/utilities: `kebab-case.ts` or `camelCase.ts` per existing file.
- Variables/functions: `camelCase`.
- Types/interfaces: `PascalCase`.

## Error Handling & Logging
- Prefer explicit `throw new Error('message')` for invalid states.
- Log actionable failures with `console.error`/`console.warn` where retries occur.
- Avoid swallowing errors; return early or rethrow when appropriate.

## Imports
- Group imports in logical blocks (framework, libs, local `$lib`, then relative).
- Keep type-only imports separated with `import type`.
- Avoid unused imports; ESLint warns on unused vars.

## Tests & Fixtures
- Test files use `*.test.ts` naming (see both app and wallet).
- Keep tests colocated with source when present.
- Favor targeted unit tests over broad integration where feasible.

## Build Artifacts
- `packages/ndk-wallet/dist` and `apps/satshoot/build` are generated.
- Avoid committing generated artifacts unless explicitly requested.

## Formatting Tips
- Run Prettier via package scripts instead of ad-hoc.
- Keep line length near the configured print width.
- Prefer auto-format before committing changes.

## Cursor / Copilot Rules
- No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` found.

## When in Doubt
- Mirror the existing file’s style and patterns.
- Keep changes minimal and scoped to the request.
- Update or add tests when behavior changes.
