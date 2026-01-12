{
description = ''A flake that creates a devShell containing the following:
		- NodeJS
		- PNPM
		- Turbo
		- Just (project maintenance/cleanup scripts)
		'';

inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
};

outputs = { self, nixpkgs, flake-utils, ... }:

    flake-utils.lib.eachDefaultSystem (system:
        let
            pkgs = nixpkgs.legacyPackages.${system};
        in {
            devShell = pkgs.mkShell {
                buildInputs = [ 
                    pkgs.ripgrep
                    pkgs.nodejs_20 
                    pkgs.nodePackages.pnpm 
                    pkgs.just
                    pkgs.cargo
                    pkgs.pkg-config
                    pkgs.openssl
                ];
                shellHook = ''
                    export PATH="$HOME/.cargo/bin:$PATH"
                    export PATH="$PWD/apps/satshoot/node_modules/.bin:$PATH"
                '';
            };
        }
    );    
}
