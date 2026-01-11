LOCKFILE := "pnpm-lock.yaml"
LOCKFILE_NDK_WALLET := "packages/ndk-wallet/pnpm-lock.yaml"

branches:
    @echo "Current branch: $(git branch --show-current)" \
        && if [[ -n $(git status --porcelain) ]]; then \
            git status --porcelain; \
        fi
    @echo "packages/ndk-wallet branch: $(cd packages/ndk-wallet && git branch --show-current)" \
        && cd packages/ndk-wallet && if [[ -n $(git status --porcelain) ]]; then \
            git status --porcelain; \
        fi

install:
    pnpm i && cd packages/ndk-wallet && pnpm i

build:
    ./ndk_compile.sh && turbo run build

dev:
    pnpm run dev

preview:
    pnpm run preview

app-dev:
    pnpm --filter satshoot dev

app-build:
    pnpm --filter satshoot build

app-check:
    pnpm --filter satshoot check

app-test:
    pnpm --filter satshoot test

wallet-dev:
    pnpm --filter @nostr-dev-kit/ndk-wallet dev

wallet-build:
    pnpm --filter @nostr-dev-kit/ndk-wallet build

wallet-test:
    pnpm --filter @nostr-dev-kit/ndk-wallet test

wallet-lint:
    pnpm --filter @nostr-dev-kit/ndk-wallet lint

wallet-format:
    pnpm --filter @nostr-dev-kit/ndk-wallet format

renew:
    rm -f {{LOCKFILE}} {{LOCKFILE_NDK_WALLET}} \
        && find . -name 'node_modules' -type d -prune -exec rm -rf '{}' + \
        && pnpm i && cd packages/ndk-wallet && pnpm i

compile-ndk:
    ./ndk_compile.sh
