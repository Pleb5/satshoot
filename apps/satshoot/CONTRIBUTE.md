# How to get SatShoot working as a Monorepo with ndk
1. Clone monorepo with ndk as a git submodule initialized:
    1. ```git clone --recurse-submodules https://github.com/Pleb5/satshoot.git```
2. If you already cloned the repo without the submodule then init manually:
    1.```git submodule update --init --recursive```
3. Install [pnpm](https://pnpm.io/) and [turbo repo](https://turbo.build/repo) globally
    1. I do this with nixOS and a nix devshell (I plan to publish my flake in the future)
    2. You can use npm or whatever crap you got
4. Go to the dir where you cloned bitcoin-troubleshoot and install all packages recursively:
    1.```pnpm i```
5. In the project root dir start the dev server:
    1.```pnpm run dev```
6. If you change anything in ndk to test out, you should restart the vite dev server
7. If you want to pull in changes from the original ndk repo you should set up a second remote with the right url:
    1. ```git remote add original_ndk https://github.com/nostr-dev-kit/ndk.git```
    2. Make sure to fetch and merge from the original remote and push to a fork
8. Clean build satshoot along with ndk(can break project in certain cases! Thanks semver..):
    1. inspect justfile and [understand](https://github.com/casey/just) what it does
    2. navigate to satshoot root folder
    3. ```just renew```
