#!/bin/bash
set -e

echo "Starting Agent Command Engine..."
echo ""

# Kill stale process on port 5173
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
echo "Port 5173 cleared."

echo ""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../src"
echo "Running npm run dev..."
npm run dev
