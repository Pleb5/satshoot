# How to Get SatShoot Working as a Monorepo

1. **Clone the Repository**
   Clone the SatShoot repository:

   ```bash
   git clone https://github.com/Pleb5/satshoot.git
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
