#!/bin/bash
# Clears common build/cache artifacts. Extend this list for the project's chosen tooling.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Clearing cache and build artifacts..."

find build -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true
find . -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
find . -type d -name .pytest_cache -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf node_modules/.cache bin obj 2>/dev/null || true

echo "Done."
