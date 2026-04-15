{
  description = "You're Just a Machine — gamedev.js jam, Phaser 3 browser game";

  inputs = {
    nixpkgs.url     = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

      perSystem = { system, pkgs, ... }:
        let
          pkgs = import inputs.nixpkgs { inherit system; };
        in
        {
          devShells.default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [
              nodejs_22
            ];

            shellHook = ''
              echo "You're Just a Machine — dev shell"
              echo ""
              echo "  npm install   install deps"
              echo "  npm run dev   start Vite dev server"
              echo ""
            '';
          };

          formatter = pkgs.nixfmt-rfc-style;
        };
    };
}
