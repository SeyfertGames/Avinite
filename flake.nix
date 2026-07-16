{
  description = "Avinite";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.stdenvNoCC.mkDerivation {
            pname = "avinite";
            version = "0.1.0";
            src = pkgs.lib.cleanSource self;

            dontBuild = true;
            installPhase = ''
              mkdir -p $out/share/avinite
              cp -r . $out/share/avinite
            '';
          };
        });

      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              pkgs.bun
              pkgs.postgresql
            ];
          };
        });

      nixosModules.avinite = import ./nixos/avinite.nix;

      nixosConfigurations.avinite = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          ./nixos/configuration.nix
          ./nixos/avinite.nix
        ];
      };
    };
}
