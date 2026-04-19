#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-architecture.sh <framework> -p <output-dir>

Copies base/architecture.md to output directory as ARCHITECTURE.md.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Output directory (required)

Examples:
  ./scripts/gen-architecture.sh nextjs -p ./my-project
  ./scripts/gen-architecture.sh nestjs -p ./my-project
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""

[ $# -ge 1 ] && [[ "$1" != -* ]] && {
  FRAMEWORK="$1"
  shift
}

while [ $# -gt 0 ]; do
  case "$1" in
  -p)
    OUTPUT_DIR="${2:?-p requires a directory}"
    shift 2
    ;;
  -h | --help)
    usage
    ;;
  *)
    echo "Unknown option: $1" >&2
    usage
    ;;
  esac
done

[ -z "$FRAMEWORK" ] && {
  echo "Error: framework is required" >&2
  usage
}
[ -z "$OUTPUT_DIR" ] && {
  echo "Error: -p <output-dir> is required" >&2
  usage
}

# ─── Guardrail: cwd must be a git repo root ───
# ARCHITECTURE.md is a project-level doc; refuse to write it from a random dir.
jkit::ensure_git_repo "."

# ─── Normalize -p to absolute (create if missing so docs/ works) ───
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(jkit::normalize_path "$OUTPUT_DIR")"

RULES_DIR="$PLUGIN_ROOT/rules/$FRAMEWORK"
BASE_ARCH="$RULES_DIR/base/architecture.md"

if [ ! -f "$BASE_ARCH" ]; then
  echo "Error: Base architecture not found: $BASE_ARCH" >&2
  exit 1
fi

OUTPUT_FILE="$OUTPUT_DIR/ARCHITECTURE.md"

cp "$BASE_ARCH" "$OUTPUT_FILE"

echo "Generated: $OUTPUT_FILE"
