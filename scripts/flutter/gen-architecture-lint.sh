#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-architecture-lint.sh flutter -p <project-dir> [-entry <dir>] [--ref <git-ref>]

Injects architecture_lint (as a git dependency) into pubspec.yaml and
registers it as an analyzer plugin in analysis_options.yaml.

Requires: poetry environment with ruamel-yaml installed.
Must be run AFTER `poetry install`.

Arguments:
  flutter        Framework name (currently flutter only)

Options:
  -p <dir>       Project root directory (required)
  -entry <dir>   Flutter entry directory (default: app)
  --ref <ref>    Git ref to pin (default: v<plugin-version> from plugin.json)

Examples:
  ./scripts/flutter/gen-architecture-lint.sh flutter -p .
  ./scripts/flutter/gen-architecture-lint.sh flutter -p . -entry app
  ./scripts/flutter/gen-architecture-lint.sh flutter -p . --ref v0.1.28
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Git coordinates ───
GIT_URL="https://github.com/JosephNK/jkit-code-plugin.git"
GIT_PATH="rules/flutter/custom-lint/architecture_lint"

# ─── Parse arguments ───
FRAMEWORK=""
PROJECT_DIR=""
ENTRY="app"
REF=""

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
    --ref)
      REF="${2:?--ref requires a value}"
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

# ─── Resolve ref from plugin.json if not provided ───
if [ -z "$REF" ]; then
  PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"
  [ ! -f "$PLUGIN_JSON" ] && { echo "Error: $PLUGIN_JSON not found" >&2; exit 1; }
  VERSION=$(python3 -c "import json,sys; print(json.load(open('$PLUGIN_JSON'))['version'])")
  REF="v${VERSION}"
fi

# ─── Resolve paths ───
PUBSPEC="$PROJECT_DIR/$ENTRY/pubspec.yaml"
ANALYSIS_OPTIONS="$PROJECT_DIR/$ENTRY/analysis_options.yaml"

[ ! -f "$PUBSPEC" ] && { echo "Error: $PUBSPEC not found" >&2; exit 1; }

# ─── Inject ───
cd "$PROJECT_DIR"
poetry run python3 "$SCRIPT_DIR/architecture_lint/inject_architecture_lint.py" \
  --pubspec "$ENTRY/pubspec.yaml" \
  --analysis-options "$ENTRY/analysis_options.yaml" \
  --git-url "$GIT_URL" \
  --git-path "$GIT_PATH" \
  --git-ref "$REF"

# ─── Invalidate Dart analyzer plugin cache ───
# Dart analyzer copies tools/analyzer_plugin/ into ~/.dartServer/.plugin_manager/
# on first load and keys it by a content hash. When the git ref changes or the
# bootstrap pubspec changes, the stale copy can linger and break resolution.
# Dropping the cache forces Dart to re-copy from the patched source on next analyze.
PLUGIN_MANAGER_CACHE="$HOME/.dartServer/.plugin_manager"
if [ -d "$PLUGIN_MANAGER_CACHE" ]; then
  rm -rf "$PLUGIN_MANAGER_CACHE"
  echo "  Cleared $PLUGIN_MANAGER_CACHE"
fi
