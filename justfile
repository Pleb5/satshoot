LOCKFILE := "pnpm-lock.yaml"
LOCKFILE_NDK_WALLET := "packages/ndk-wallet/pnpm-lock.yaml"

branches:
    @echo "Current branch: `git branch --show-current`" \
        && if [[ -n $(git status --porcelain) ]]; then \
            git status --porcelain; \
        fi
    @echo "packages/ndk-wallet branch: `cd packages/ndk-wallet && git branch --show-current`" \
        && cd packages/ndk-wallet && if [[ -n $(git status --porcelain) ]]; then \
            git status --porcelain; \
        fi

build:
    turbo build

renew:
    if [ -f {{LOCKFILE}} ]; then \
        rm {{LOCKFILE}}; \
    fi \
    && \
    if [ -f {{LOCKFILE_NDK_WALLET}} ]; then \
        echo asdf \
        && rm {{LOCKFILE_NDK_WALLET}}; \
    fi \
    && find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \; \
    && pnpm i && cd packages/ndk-wallet && pnpm i

compile-ndk:
    ./ndk_compile.sh
