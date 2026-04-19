#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-conventions.sh <framework> -p <output-dir> [--with stack1,stack2,...]

Concatenates base/CONVENTIONS.md + selected stack CONVENTIONS.md files.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Output directory (required)
  --with <list>  Comma-separated stacks (e.g. mantine,tanstack-query)

Examples:
  ./scripts/gen-conventions.sh nextjs -p ./my-project --with mantine,tanstack-query,next-proxy
  ./scripts/gen-conventions.sh nestjs -p ./my-project --with typeorm
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
STACKS=""

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
  --with)
    STACKS="${2:?--with requires a stack list}"
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
jkit::ensure_git_repo "."

# ─── Normalize -p to absolute ───
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(jkit::normalize_path "$OUTPUT_DIR")"

RULES_DIR="$PLUGIN_ROOT/rules/$FRAMEWORK"
BASE_CONV="$RULES_DIR/base/conventions.md"

if [ ! -f "$BASE_CONV" ]; then
  echo "Error: Base conventions not found: $BASE_CONV" >&2
  exit 1
fi

# ─── Concatenate base + stacks ───
OUTPUT_FILE="$OUTPUT_DIR/CONVENTIONS.md"

cp "$BASE_CONV" "$OUTPUT_FILE"

if [ -n "$STACKS" ]; then
  IFS=',' read -ra STACK_LIST <<<"$STACKS"
  for stack in "${STACK_LIST[@]}"; do
    stack=$(echo "$stack" | xargs)
    STACK_CONV="$RULES_DIR/$stack/conventions.md"

    if [ ! -f "$STACK_CONV" ]; then
      echo "Warning: conventions.md not found for stack '$stack': $STACK_CONV" >&2
      continue
    fi

    printf '\n' >>"$OUTPUT_FILE"
    cat "$STACK_CONV" >>"$OUTPUT_FILE"
  done
fi

echo "Generated: $OUTPUT_FILE"
if [ -n "$STACKS" ]; then
  echo "Stacks: $STACKS"
fi
