#!/bin/bash
echo "Clearing cache and build artifacts..."

[ -d build ] && find build -mindepth 1 ! -name '.gitkeep' -delete 2>/dev/null
find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find . -type d -name '.pytest_cache' -exec rm -rf {} + 2>/dev/null || true
[ -d node_modules/.cache ] && rm -rf node_modules/.cache
[ -d bin ] && rm -rf bin
[ -d obj ] && rm -rf obj

echo "Done."
