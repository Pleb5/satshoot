{
description = ''A flake that creates a devShell containing the following:
			- Nixvim (based on nixos-unstable)
            - NodeJS
            - PNPM
            - Turbo
            - Just (project maintenance/cleanup scripts)
		'';

inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nixvim.url = "github:Pleb5/neovim-flake/master";
};

outputs = { self, nixpkgs, flake-utils, nixvim, ... }:

    flake-utils.lib.eachDefaultSystem (system:
        let
            pkgs = nixpkgs.legacyPackages.${system};
            nvim = nixvim.packages.${system}.nvim;
        in {
            devShell = pkgs.mkShell {
                buildInputs = [ 
                    nvim
                    pkgs.ripgrep
                    pkgs.nodejs_20 
                    pkgs.nodePackages.pnpm 
                    pkgs.turbo 
                    pkgs.just
                    pkgs.cargo
                    pkgs.pkg-config
                    pkgs.openssl
                ];
                shellHook = ''
                    export PATH="$HOME/.cargo/bin:$PATH"
                '';
            };
        }
    );    
}
