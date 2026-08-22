#!/bin/bash
# Regenerates docs/node-map.html - the second brain that brain.js queries.
# See .claude/skills/build-node-map/SKILL.md for when to run this.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
MAP="$ROOT/docs/node-map.html"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js was not found on PATH."
  echo "  The node map generator needs Node; install it or run scripts/setup.sh first."
  exit 1
fi

echo "Rebuilding the ACE node map..."
node "$SCRIPT_DIR/build-node-map.js"

if [ ! -f "$MAP" ]; then
  echo "ERROR: Generator reported success but the map was not written:"
  echo "  $MAP"
  exit 1
fi

echo ""
echo "Node map written to $MAP"
echo "  Open it in a browser to explore, or query it with:"
echo "    node .claude/skills/node-map/assets/brain.js \"your question\""
