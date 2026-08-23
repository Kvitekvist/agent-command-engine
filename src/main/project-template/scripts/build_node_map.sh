#!/bin/bash
# Regenerates docs/node-map.html (the second brain brain.js queries).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found on PATH."
  exit 1
fi

node scripts/build-node-map.js

if [ ! -f docs/node-map.html ]; then
  echo "docs/node-map.html was not written."
  exit 1
fi
echo "Wrote docs/node-map.html"
