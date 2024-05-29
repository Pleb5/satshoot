LOCKFILE := "pnpm-lock.yaml"
LOCKFILE_NDK := "packages/ndk/pnpm-lock.yaml"

branches:
    @echo "Current branch: `git branch --show-current`" \
        && if [[ -n $(git status --porcelain) ]]; then \
            git status --porcelain; \
        fi
    @echo "packages/ndk branch: `cd packages/ndk && git branch --show-current`" \
        && cd packages/ndk && if [[ -n $(git status --porcelain) ]]; then \
            git status --porcelain; \
        fi

update:
    git submodule update --recursive --remote
    cd packages/ndk && git checkout master && git pull

build:
    turbo build
renew:
    if [ -f {{LOCKFILE}} ]; then \
        rm {{LOCKFILE}}; \
    fi \
    && \
    if [ -f {{LOCKFILE_NDK}} ]; then \
        echo asdf \
        && rm {{LOCKFILE_NDK}}; \
    fi \
    && find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \; \
    && pnpm i && cd packages/ndk && pnpm i

compile-ndk:
    ./ndk_compile.sh

