{ config, lib, pkgs, ... }:
let
  cfg = config.services.avinite;
  avinitePkg = pkgs.stdenvNoCC.mkDerivation {
    pname = "avinite";
    version = "0.1.0";
    src = pkgs.lib.cleanSource ../.;

    dontBuild = true;
    installPhase = ''
      mkdir -p $out/share/avinite
      cp -r . $out/share/avinite
    '';
  };
in
{
  options.services.avinite = {
    enable = lib.mkEnableOption "Avinite service";

    package = lib.mkOption {
      type = lib.types.package;
      default = avinitePkg;
      description = "Package containing the Avinite source tree.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Host to bind the Bun server to.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "TCP port used by Avinite.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Optional environment file passed to the systemd service.";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to expose the Avinite port through the firewall.";
    };
  };

  config = lib.mkIf cfg.enable {
    services.postgresql.enable = lib.mkDefault true;

    systemd.services.avinite = {
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" "postgresql.service" ];
      wants = [ "network-online.target" ];

      serviceConfig = {
        Type = "simple";
        WorkingDirectory = "${cfg.package}/share/avinite";
        ExecStart = "${pkgs.bun}/bin/bun ${cfg.package}/share/avinite/src/index.ts";
        Restart = "on-failure";
        RestartSec = 5;
        Environment = [
          "PORT=${toString cfg.port}"
          "HOST=${cfg.host}"
        ];
      } // lib.optionalAttrs (cfg.environmentFile != null) {
        EnvironmentFile = cfg.environmentFile;
      };
    };

  } // lib.mkIf cfg.openFirewall {
    networking.firewall.allowedTCPPorts = [ cfg.port ];
  };
}