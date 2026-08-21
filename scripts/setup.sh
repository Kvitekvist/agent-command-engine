#!/bin/bash
set -e

echo "============================================================"
echo " Agent Command Engine - Setup"
echo "============================================================"

echo ""
echo "[1/3] Checking Node.js (v18+ required)..."
if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js not found. Install from https://nodejs.org"
    exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
echo "Found Node.js v${NODE_VER}"

echo ""
echo "[2/3] Installing dependencies (clean install)..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../src"

if [ -d node_modules ]; then
    echo "Removing previous node_modules..."
    rm -rf node_modules
fi
[ -f package-lock.json ] && rm -f package-lock.json

echo "Installing packages..."
npm install

# macOS: provision the stable self-signed code-signing identity the packaged
# build expects, so Screen Recording (TCC) grants survive rebuilds (TICKET-0062).
# Idempotent and a no-op on non-macOS.
if [ "$(uname)" = "Darwin" ]; then
    echo ""
    echo "[macOS] Provisioning code-signing identity..."
    bash "$SCRIPT_DIR/setup-mac-signing.sh" || \
        echo "WARNING: signing setup did not complete; builds will fall back to ad-hoc signing."
fi

echo ""
echo "[3/3] Setup complete!"
echo ""
echo "Start the app with:"
echo "  scripts/run.sh"
