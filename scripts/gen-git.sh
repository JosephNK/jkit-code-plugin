#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-git.sh -p <output-dir>

Copies common/git.md to output directory as GIT.md.

Options:
  -p <dir>       Output directory (required)

Examples:
  ./scripts/gen-git.sh -p ./my-project
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# ─── Parse arguments ───
OUTPUT_DIR=""

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

[ -z "$OUTPUT_DIR" ] && {
  echo "Error: -p <output-dir> is required" >&2
  usage
}

# ─── Guardrail: cwd must be a git repo root ───
jkit::ensure_git_repo "."

# ─── Normalize -p to absolute ───
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(jkit::normalize_path "$OUTPUT_DIR")"

SOURCE="$PLUGIN_ROOT/rules/common/git.md"

if [ ! -f "$SOURCE" ]; then
  echo "Error: git.md not found: $SOURCE" >&2
  exit 1
fi

OUTPUT_FILE="$OUTPUT_DIR/GIT.md"

cp "$SOURCE" "$OUTPUT_FILE"

echo "Generated: $OUTPUT_FILE"
