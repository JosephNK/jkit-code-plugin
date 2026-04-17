#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../common.sh
source "$SCRIPT_DIR/../common.sh"

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-scripts.sh -p <output-dir> [-entry <dir>]

Generates wrapper shell scripts for Flutter project utilities.

Options:
  -p <dir>         Output directory (required, Flutter project root)
  -entry <dir>     Flutter entry directory (default: app). Used only for project-root validation.

Examples:
  ./scripts/flutter/gen-scripts.sh -p .
  ./scripts/flutter/gen-scripts.sh -p /path/to/my-flutter-project
  ./scripts/flutter/gen-scripts.sh -p . -entry client
EOF
  exit 1
}

# ─── Parse arguments ───
OUTPUT_DIR=""
ENTRY="app"

while [ $# -gt 0 ]; do
  case "$1" in
    -p)
      OUTPUT_DIR="${2:?-p requires a directory}"
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

[ -z "$OUTPUT_DIR" ] && { echo "Error: -p <output-dir> is required" >&2; usage; }

# ─── Guardrail: -p must be a Flutter project root ───
jkit::ensure_flutter_root "$OUTPUT_DIR" "$ENTRY"

# ─── Normalize -p to absolute ───
OUTPUT_DIR="$(jkit::normalize_path "$OUTPUT_DIR")"

# ─── Ensure scripts directory exists ───
SCRIPTS_DIR="$OUTPUT_DIR/scripts"
mkdir -p "$SCRIPTS_DIR"

# ─── Helper: plugin root finder ───
PLUGIN_ROOT_SNIPPET='PLUGIN_ROOT=$(ls -d ~/.claude/plugins/cache/jkit/jkit/*/ 2>/dev/null | sort -V | tail -1)
if [ -z "$PLUGIN_ROOT" ]; then
  echo "Error: jkit plugin not found in ~/.claude/plugins/cache/" >&2
  exit 1
fi'

# ─── Generate flutter-build-deploy.sh ───
cat > "$SCRIPTS_DIR/flutter-build-deploy.sh" <<SCRIPT
#!/bin/bash
set -euo pipefail
PROJECT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
$PLUGIN_ROOT_SNIPPET
cd "\$PLUGIN_ROOT" && poetry run python scripts/flutter/build/flutter_build_deploy.py "\$@" --project-dir "\$PROJECT_DIR"
SCRIPT
chmod +x "$SCRIPTS_DIR/flutter-build-deploy.sh"
echo "Generated: $SCRIPTS_DIR/flutter-build-deploy.sh"

# ─── Generate update-dependencies.sh ───
cat > "$SCRIPTS_DIR/update-dependencies.sh" <<SCRIPT
#!/bin/bash
set -euo pipefail
PROJECT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
$PLUGIN_ROOT_SNIPPET
cd "\$PLUGIN_ROOT" && poetry run python scripts/flutter/dependencies/update_dependencies.py "\$@" --project-dir "\$PROJECT_DIR"
SCRIPT
chmod +x "$SCRIPTS_DIR/update-dependencies.sh"
echo "Generated: $SCRIPTS_DIR/update-dependencies.sh"

# ─── Generate update-leaf-kit-ref.sh ───
cat > "$SCRIPTS_DIR/update-leaf-kit-ref.sh" <<SCRIPT
#!/bin/bash
set -euo pipefail
PROJECT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
$PLUGIN_ROOT_SNIPPET
cd "\$PLUGIN_ROOT" && poetry run python scripts/flutter/dependencies/update_leaf_kit_ref.py "\$@" --project-dir "\$PROJECT_DIR"
SCRIPT
chmod +x "$SCRIPTS_DIR/update-leaf-kit-ref.sh"
echo "Generated: $SCRIPTS_DIR/update-leaf-kit-ref.sh"

# ─── Generate android-show-info-keystore.sh ───
cat > "$SCRIPTS_DIR/android-show-info-keystore.sh" <<SCRIPT
#!/bin/bash
set -euo pipefail
PROJECT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
$PLUGIN_ROOT_SNIPPET
cd "\$PLUGIN_ROOT" && poetry run python scripts/flutter/keystore/android_show_info_keystore.py "\$@" --project-dir "\$PROJECT_DIR"
SCRIPT
chmod +x "$SCRIPTS_DIR/android-show-info-keystore.sh"
echo "Generated: $SCRIPTS_DIR/android-show-info-keystore.sh"

# ─── Generate android-signing-report.sh ───
cat > "$SCRIPTS_DIR/android-signing-report.sh" <<SCRIPT
#!/bin/bash
set -euo pipefail
PROJECT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
$PLUGIN_ROOT_SNIPPET
cd "\$PLUGIN_ROOT" && poetry run python scripts/flutter/keystore/android_signing_report_keystore.py "\$@" --project-dir "\$PROJECT_DIR"
SCRIPT
chmod +x "$SCRIPTS_DIR/android-signing-report.sh"
echo "Generated: $SCRIPTS_DIR/android-signing-report.sh"

# ─── Generate android-signing-verify-apk.sh ───
cat > "$SCRIPTS_DIR/android-signing-verify-apk.sh" <<SCRIPT
#!/bin/bash
set -euo pipefail
PROJECT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"
$PLUGIN_ROOT_SNIPPET
cd "\$PLUGIN_ROOT" && poetry run python scripts/flutter/keystore/android_signing_verify_apk.py "\$@" --project-dir "\$PROJECT_DIR"
SCRIPT
chmod +x "$SCRIPTS_DIR/android-signing-verify-apk.sh"
echo "Generated: $SCRIPTS_DIR/android-signing-verify-apk.sh"

echo ""
echo "Done! Generated 6 scripts in $SCRIPTS_DIR/"
