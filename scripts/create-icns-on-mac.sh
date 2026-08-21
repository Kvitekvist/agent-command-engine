#!/bin/bash
# Run this script on macOS to create the .icns file
# Usage: ./scripts/create-icns-on-mac.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ICONSET_DIR="$PROJECT_ROOT/build/icon.iconset"
OUTPUT_ICNS="$PROJECT_ROOT/build/icon.icns"

if [ ! -d "$ICONSET_DIR" ]; then
    echo "Error: iconset directory not found at $ICONSET_DIR"
    echo "Run scripts/create-icons.py first to generate the PNG set"
    exit 1
fi

if [ "$(uname)" != "Darwin" ]; then
    echo "Warning: This script should be run on macOS"
    echo "The iconutil command is only available on Mac"
    exit 1
fi

echo "Creating .icns file from iconset..."
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

if [ -f "$OUTPUT_ICNS" ]; then
    echo "✓ Successfully created: $OUTPUT_ICNS"
    ls -lh "$OUTPUT_ICNS"
else
    echo "✗ Failed to create .icns file"
    exit 1
fi
