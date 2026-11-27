#!/bin/bash
# Runs the full Agent Command Engine test suite via Node's built-in test runner.
#
# The suite is intentionally dependency-free: it only exercises main-process
# service logic whose third-party imports are absent at load time or stubbed
# (electron), so it runs WITHOUT `npm install` and without launching Electron.
set -e
trap 'exit 2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../src"

echo "Running Agent Command Engine test suite..."
echo ""

# Failures exit 2 with the output on stderr: Claude Code hooks only feed an
# error back to Claude in that case.
if ! node --test tests/*.test.js >&2; then
  echo "❌ Some tests failed." >&2
  exit 2
fi
echo "✅ All tests passed."
