# How to get SatShoot working as a Monorepo with ndk
1. Clone monorepo with ndk as a git submodule initialized:
    1. ```bash
        git clone --recurse-submodules https://github.com/Pleb5/satshoot.git
        ```
2. If you already cloned the repo without the submodule then init manually:
    1.  ```bash
        git submodule update --init --recursive
        ```
3. Install [pnpm](https://pnpm.io/), [turbo repo](https://turbo.build/repo) and [just](https://github.com/casey/just) globally
    1. I do this with nixOS and a [nix devshell](https://github.com/Pleb5/devshell)
    2. You can use [npm](install_tools.sh) or whatever crap you got
4. Go to the dir where you cloned SatShoot and install all packages recursively:
    1.  ```bash
        pnpm i
        ```
5. In the project root dir start the dev server:
    1.  ```bash
        pnpm run dev
        ```
6. If you change anything in ndk to test out, you should restart the vite dev server
7. If you want to pull in changes from the original ndk repo you should set up a second remote with the right url:
    1. ```bash
       git remote add original_ndk https://github.com/nostr-dev-kit/ndk.git
        ```
    2. Make sure to fetch and merge from the original remote and push to a fork
8. Clean build satshoot along with ndk(can break project in certain cases! Thanks semver..):
    1. inspect justfile and [understand](https://github.com/casey/just) what it does
    2. navigate to satshoot root folder
    3.  ```bash
        just renew
        ```
