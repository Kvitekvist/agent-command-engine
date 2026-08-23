#!/bin/bash
# Installs the latest Agent Command Engine release into /Applications without
# a manual browser download. Run directly:
#
#   curl -fsSL https://raw.githubusercontent.com/Kvitekvist/agent-command-engine/main/scripts/install-mac.sh | bash
#
# Picks the dmg matching this Mac's CPU (arm64 vs x64) from the latest
# GitHub release, mounts it, copies the .app to /Applications, and strips the
# quarantine flag -- builds are unsigned (no Apple Developer cert), so without
# that step Gatekeeper blocks the first launch outright.
set -euo pipefail

REPO="Kvitekvist/agent-command-engine"
ARCH="$(uname -m)"
[ "$ARCH" = "arm64" ] && WANT="arm64" || WANT="x64"

echo "Fetching latest release info..."
RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")"

DMG_URL="$(echo "$RELEASE_JSON" | grep -o "\"browser_download_url\": *\"[^\"]*$WANT[^\"]*\.dmg\"" | head -1 | sed -E 's/.*"(https[^"]+)"/\1/')"
if [ -z "$DMG_URL" ]; then
  DMG_URL="$(echo "$RELEASE_JSON" | grep -o '"browser_download_url": *"[^"]*\.dmg"' | head -1 | sed -E 's/.*"(https[^"]+)"/\1/')"
fi
if [ -z "$DMG_URL" ]; then
  echo "Error: no .dmg asset found on the latest release. Has a macOS build been published yet?" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
DMG_PATH="$TMP_DIR/ace.dmg"

echo "Downloading $DMG_URL"
curl -fsSL -o "$DMG_PATH" "$DMG_URL"

echo "Mounting disk image..."
MOUNT_POINT="$(hdiutil attach "$DMG_PATH" -nobrowse -readonly | tail -1 | awk -F'\t' '{print $NF}')"
trap 'hdiutil detach "$MOUNT_POINT" -quiet >/dev/null 2>&1 || true; rm -rf "$TMP_DIR"' EXIT

APP_PATH="$(find "$MOUNT_POINT" -maxdepth 1 -name '*.app' | head -1)"
if [ -z "$APP_PATH" ]; then
  echo "Error: no .app bundle found inside the disk image." >&2
  exit 1
fi
APP_NAME="$(basename "$APP_PATH")"

echo "Installing $APP_NAME to /Applications..."
rm -rf "/Applications/$APP_NAME"
cp -R "$APP_PATH" /Applications/
xattr -cr "/Applications/$APP_NAME"

echo "Done. Launch it from /Applications/$APP_NAME"
