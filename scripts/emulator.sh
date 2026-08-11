#!/usr/bin/env bash
#
# Launch the Android emulator OUTSIDE VS Code's process tree.
#
# Why this exists: when the emulator is started from VS Code's integrated
# terminal it inherits VS Code's systemd scope (app-code-<pid>.scope). qemu
# then grows to 5-6 GB, the machine runs out of memory, and the kernel OOM
# killer goes looking for victims inside that scope -- which is why VS Code
# kept disappearing mid-session.
#
# `systemd-run --user --scope` puts the emulator in its own scope with its own
# memory ceiling, so a runaway emulator gets killed instead of the editor.
#
# Usage:
#   npm run emulator             # default AVD (Small_Phone)
#   npm run emulator Pixel_10_Pro_Fold
set -euo pipefail

AVD="${1:-Small_Phone}"
MEM_MAX="${EMULATOR_MEM_MAX:-4G}"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
EMULATOR="$SDK/emulator/emulator"

if [[ ! -x "$EMULATOR" ]]; then
  echo "error: emulator not found at $EMULATOR" >&2
  echo "set ANDROID_HOME to your SDK location" >&2
  exit 1
fi

if ! "$EMULATOR" -list-avds | grep -qx "$AVD"; then
  echo "error: no AVD named '$AVD'. Available:" >&2
  "$EMULATOR" -list-avds >&2
  exit 1
fi

# -gpu host       : use the real GPU. 'auto' can fall back to software rendering
#                   (SwiftShader), which allocates large host-side framebuffers.
# -no-snapshot-save: skip writing a multi-GB snapshot on every exit.
# -no-boot-anim   : trivial, but saves startup CPU/memory churn.
ARGS=(-avd "$AVD" -gpu host -no-snapshot-save -no-boot-anim)

echo "starting AVD '$AVD' (memory cap: $MEM_MAX) in its own scope..."

if command -v systemd-run >/dev/null 2>&1; then
  exec systemd-run --user --scope \
    --unit="android-emulator-$AVD" \
    --property=MemoryMax="$MEM_MAX" \
    --property=MemorySwapMax=0 \
    --property=OOMPolicy=continue \
    "$EMULATOR" "${ARGS[@]}"
else
  echo "warning: systemd-run unavailable; emulator stays in this shell's cgroup" >&2
  exec "$EMULATOR" "${ARGS[@]}"
fi
