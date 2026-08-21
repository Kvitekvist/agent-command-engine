#!/bin/bash
# Runs the full Agent Command Engine test suite via Node's built-in test runner.
#
# The suite is intentionally dependency-free: it only exercises main-process
# service logic whose third-party imports are absent at load time or stubbed
# (electron), so it runs WITHOUT `npm install` and without launching Electron.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../src"

echo "Running Agent Command Engine test suite..."
echo ""

# node --test discovers and runs every *.test.js under tests/. A non-zero exit
# from a failing test propagates out (via set -e) as this script's exit code.
node --test tests/*.test.js
STATUS=$?

echo ""
if [ "$STATUS" -eq 0 ]; then
  echo "✅ All tests passed."
else
  echo "❌ Some tests failed."
fi

exit "$STATUS"
