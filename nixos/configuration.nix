{ config, pkgs, lib, ... }:
{
  imports = [ ./avinite.nix ];

  services.avinite = {
    enable = true;
    port = 3000;
    host = "127.0.0.1";
    environmentFile = "/etc/avinite.env";
    openFirewall = false;
  };

  services.postgresql.enable = true;
}
