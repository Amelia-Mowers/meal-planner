let
  nixpkgs = builtins.getFlake "nixpkgs";
  pkgs = import nixpkgs { system = "x86_64-linux"; config = { allowUnfree = true; android_sdk.accept_license = true; }; };
  android = pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "34" ];
    includeEmulator = true;
    includeSystemImages = true;
    systemImageTypes = [ "google_apis" ];
    abiVersions = [ "x86_64" ];
    includeNDK = false;
  };
in pkgs.symlinkJoin { name = "mp-android"; paths = [ android.androidsdk pkgs.jdk17 ]; }
