# How to Get SatShoot Working as a Monorepo

1. **Clone the Repository**
   Clone monorepo with ndk-wallet as a git submodule initialized:
    1. ```bash
        git clone --recurse-submodules https://github.com/Pleb5/satshoot.git
   ```
    2. If you already cloned the repo without the submodule then init manually:
      ```bash
        git submodule update --init --recursive
        ```

2. **Install Required Global Tools**
   You will need to install a few global tools.
   If you're using NixOS, you can install them with a Nix devshell:

   - [pnpm](https://pnpm.io/)
   - [Turbo Repo](https://turbo.build/repo)
   - [Just](https://github.com/casey/just)

   Alternatively, you can install them using `npm` or your preferred package manager:

   ```bash
   npm install -g pnpm turbo just
   ```

3. **Install Dependencies**
   Go to the directory where you cloned SatShoot and install all dependencies recursively:

   ```bash
   pnpm i
   ```

4. **Start the Development Server**
   In the root of the project, start the dev server:

   ```bash
   pnpm run dev
   ```

5. **Clean and Rebuild SatShoot**
   To perform a clean build of SatShoot, run:

   ```bash
   just renew
   ```

6. If you change anything in ndk-wallet to test out, you should restart the vite dev server
7. If you want to pull in changes from the original ndk-wallet repo you should set up a second remote with the right url:
    1. ```bash
       git remote add original_ndk https://github.com/rodant/ndk-wallet.git
        ```
    2. Make sure to fetch and merge from the original remote and push to a fork
8. Clean build satshoot along with ndk-wallet(can break project in certain cases! Thanks semver..):
    1. inspect justfile and [understand](https://github.com/casey/just) what it does
    2. navigate to satshoot root folder
    3.  ```bash
        just renew
        ```
