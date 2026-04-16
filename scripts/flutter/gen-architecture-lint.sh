#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-architecture-lint.sh flutter -p <project-dir> [-entry <dir>]

Injects architecture_lint into pubspec.yaml (dev_dependency) and
analysis_options.yaml (analyzer plugin).

Requires: poetry environment with ruamel-yaml installed.
Must be run AFTER `poetry install`.

Arguments:
  flutter        Framework name (currently flutter only)

Options:
  -p <dir>       Project root directory (required)
  -entry <dir>   Flutter entry directory (default: app)

Examples:
  ./scripts/flutter/gen-architecture-lint.sh flutter -p .
  ./scripts/flutter/gen-architecture-lint.sh flutter -p . -entry app
  ./scripts/flutter/gen-architecture-lint.sh flutter -p . -entry client
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Parse arguments ───
FRAMEWORK=""
PROJECT_DIR=""
ENTRY="app"

# First positional arg is framework
[ $# -ge 1 ] && [[ "$1" != -* ]] && { FRAMEWORK="$1"; shift; }

while [ $# -gt 0 ]; do
  case "$1" in
    -p)
      PROJECT_DIR="${2:?-p requires a directory}"
      shift 2
      ;;
    -entry)
      ENTRY="${2:?-entry requires a directory}"
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
[ -z "$PROJECT_DIR" ] && { echo "Error: -p <project-dir> is required" >&2; usage; }

# ─── Resolve paths ───
LINT_PATH="$PLUGIN_ROOT/rules/flutter/custom-lint/architecture_lint"
PUBSPEC="$PROJECT_DIR/$ENTRY/pubspec.yaml"
ANALYSIS_OPTIONS="$PROJECT_DIR/$ENTRY/analysis_options.yaml"

# Validate
[ ! -f "$PUBSPEC" ] && { echo "Error: $PUBSPEC not found" >&2; exit 1; }
[ ! -d "$LINT_PATH" ] && { echo "Error: $LINT_PATH not found" >&2; exit 1; }

# ─── Inject ───
cd "$PROJECT_DIR"
poetry run python3 "$SCRIPT_DIR/architecture_lint/inject_architecture_lint.py" \
  --pubspec "$ENTRY/pubspec.yaml" \
  --analysis-options "$ENTRY/analysis_options.yaml" \
  --lint-path "$LINT_PATH"
