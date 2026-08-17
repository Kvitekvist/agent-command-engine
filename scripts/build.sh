#!/bin/bash
set -e

echo "Building Agent Command Engine..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/bump-version.js"
cd "$SCRIPT_DIR/../src"
npm run build
echo ""
echo "Build complete. Run 'npm run package' inside src/ to create installer."
