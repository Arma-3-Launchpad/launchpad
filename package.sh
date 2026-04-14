#!/usr/bin/env bash
# Deprecated: use  python3 package.py build   (or python package.py build)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
echo "DEPRECATED: use  python3 package.py build" >&2
if command -v python3 >/dev/null 2>&1; then
  exec python3 "$ROOT/package.py" build
fi
if command -v python >/dev/null 2>&1; then
  exec python "$ROOT/package.py" build
fi
echo "ERROR: Neither python3 nor python found on PATH." >&2
exit 1
