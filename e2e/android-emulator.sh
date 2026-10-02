#!/usr/bin/env bash
# Boot a headless Android 14 (Google APIs, includes Chrome) emulator for `npm run test:android`.
# Uses Nix to fetch the SDK (needs KVM). Prints the adb PATH line to use afterwards.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/meal-planner-android"
mkdir -p "$CACHE"
SDK_LINK="$CACHE/sdk"
[ -e "$SDK_LINK" ] || nix build --impure --expr "import $HERE/android-sdk.nix" -o "$SDK_LINK"
export ANDROID_SDK_ROOT="$(readlink -f "$SDK_LINK")/libexec/android-sdk"
export ANDROID_AVD_HOME="$CACHE/avd" ANDROID_USER_HOME="$CACHE/user"
export JAVA_HOME="$(readlink -f "$SDK_LINK")/lib/openjdk"
export PATH="$(readlink -f "$SDK_LINK")/bin:$PATH"
mkdir -p "$ANDROID_AVD_HOME" "$ANDROID_USER_HOME"

if [ ! -d "$ANDROID_AVD_HOME/mp.avd" ]; then
  echo no | avdmanager create avd -n mp \
    -k "system-images;android-34;google_apis;x86_64" -d pixel_6 --force
  # Default userdata is ~7 GB; Chrome needs far less.
  sed -i -E 's/^disk\.dataPartition\.size ?= ?.*/disk.dataPartition.size = 2G/; s/^sdcard\.size ?= ?.*/sdcard.size = 64 MB/' \
    "$ANDROID_AVD_HOME/mp.avd/config.ini"
fi

emulator -avd mp -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect >"$CACHE/emulator.log" 2>&1 &
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
# Skip Chrome's first-run screens.
adb shell 'echo "chrome --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'
echo "Emulator ready. Use: export PATH=\"$(readlink -f "$SDK_LINK")/bin:\$PATH\""
