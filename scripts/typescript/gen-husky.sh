#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-husky.sh <framework> -p <output-dir>

Generates .husky hook files for the given framework.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Output directory (required)

Examples:
  ./scripts/gen-husky.sh nextjs -p ./my-project
  ./scripts/gen-husky.sh nestjs -p ./my-project
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""

# First positional arg is framework
[ $# -ge 1 ] && [[ "$1" != -* ]] && { FRAMEWORK="$1"; shift; }

while [ $# -gt 0 ]; do
  case "$1" in
    -p)
      OUTPUT_DIR="${2:?-p requires a directory}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

[ -z "$FRAMEWORK" ] && { echo "Error: framework is required" >&2; usage; }
[ -z "$OUTPUT_DIR" ] && { echo "Error: -p <output-dir> is required" >&2; usage; }

HUSKY_SRC="$PLUGIN_ROOT/rules/$FRAMEWORK/base/husky"

if [ ! -d "$HUSKY_SRC" ]; then
  echo "Error: Husky templates not found: $HUSKY_SRC" >&2
  exit 1
fi

# ─── Copy husky hooks ───
HUSKY_DEST="$OUTPUT_DIR/.husky"
mkdir -p "$HUSKY_DEST"

for hook in "$HUSKY_SRC"/*; do
  [ -f "$hook" ] || continue
  hook_name=$(basename "$hook")
  cp "$hook" "$HUSKY_DEST/$hook_name"
  chmod +x "$HUSKY_DEST/$hook_name"
  echo "Generated: $HUSKY_DEST/$hook_name"
done
