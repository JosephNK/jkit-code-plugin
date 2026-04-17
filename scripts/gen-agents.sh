#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-agents.sh <framework> -p <output-dir> [-n <project-name>] [--docs-dir <dir>]

Generates AGENTS.md and creates CLAUDE.md symlink.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs, flutter)

Options:
  -p <dir>       Output directory (required)
  -n <name>      Project name (default: directory name)
  --docs-dir <dir>  Docs directory prefix for reference paths (default: root)

Examples:
  ./scripts/gen-agents.sh nextjs -p . -n "My Project"              # refs: ARCHITECTURE.md
  ./scripts/gen-agents.sh nextjs -p . -n "My Project" --docs-dir docs      # refs: docs/ARCHITECTURE.md
  ./scripts/gen-agents.sh nestjs -p .
  ./scripts/gen-agents.sh flutter -p .
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
PROJECT_NAME=""
DOCS_DIR=""

[ $# -ge 1 ] && [[ "$1" != -* ]] && { FRAMEWORK="$1"; shift; }

while [ $# -gt 0 ]; do
  case "$1" in
    -p)
      OUTPUT_DIR="${2:?-p requires a directory}"
      shift 2
      ;;
    -n)
      PROJECT_NAME="${2:?-n requires a project name}"
      shift 2
      ;;
    --docs-dir)
      DOCS_DIR="${2:?--docs-dir requires a directory}"
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

# ─── Guardrail: -p must be a project root (git repo) ───
# AGENTS.md/CLAUDE.md symlink live at the project root. Refuse to write them
# into a random subdirectory (e.g. accidental `-p .` from inside `app/`).
jkit::ensure_git_repo "$OUTPUT_DIR"

# ─── Normalize -p to absolute so downstream paths ignore cwd drift ───
OUTPUT_DIR="$(jkit::normalize_path "$OUTPUT_DIR")"

# Build DOCS_DIR: add trailing slash if not empty
if [ -n "$DOCS_DIR" ]; then
  DOCS_DIR="${DOCS_DIR%/}/"
fi

# Default project name to directory basename
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME="$(basename "$OUTPUT_DIR")"
fi

RULES_DIR="$PLUGIN_ROOT/rules/$FRAMEWORK"
TEMPLATE="$RULES_DIR/base/agents.template.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: Template not found: $TEMPLATE" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/AGENTS.md"

# Replace placeholders in template
sed -e "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" -e "s|{{DOCS_DIR}}|$DOCS_DIR|g" "$TEMPLATE" > "$OUTPUT_FILE"

# Create CLAUDE.md symlink
SYMLINK="$OUTPUT_DIR/CLAUDE.md"
if [ -e "$SYMLINK" ] || [ -L "$SYMLINK" ]; then
  rm "$SYMLINK"
fi
ln -s AGENTS.md "$SYMLINK"

echo "Generated: $OUTPUT_FILE"
echo "Symlink: $SYMLINK -> AGENTS.md"
