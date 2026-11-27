#!/bin/bash
# Runs the project's test suite. This is what CI runs - keep it the single
# entry point, so "how do I verify this repo" has exactly one answer.
#
# Customize the command below for the project's stack (pytest, node --test,
# dotnet test, ...). Until then it reports that no suite is configured and
# exits 0 so a fresh template still has a green pipeline.
set -e
# Any failure exits 2 with its output on stderr: Claude Code hooks only feed an
# error back to Claude in that case.
trap 'exit 2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -d tests ] || [ -z "$(find tests -type f ! -name '.gitkeep' -print -quit)" ]; then
  echo "No tests configured yet. Edit scripts/run_tests.sh when the first test lands."
  exit 0
fi

echo "tests/ has files but scripts/run_tests.sh has no runner configured." >&2
echo "Add the project's test command (pytest / node --test / dotnet test) here, ending in >&2." >&2
exit 2
