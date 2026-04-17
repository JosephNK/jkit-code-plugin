#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-pyproject.sh flutter -p <output-dir> -n <name> [-entry <dir>] [-d <description>] [-a <author>]

Generates pyproject.toml for a Flutter project.

Arguments:
  flutter          Framework name (currently flutter only)

Options:
  -p <dir>         Output directory (required, must be the Flutter project root)
  -n <name>        Project name (required, e.g. my-app)
  -entry <dir>     Flutter entry directory (default: app). Used only for project-root validation.
  -d <description> Project description (default: "Flutter project scripts")
  -a <author>      Author (default: empty, e.g. "Name <email>")

Examples:
  ./scripts/gen-pyproject.sh flutter -p . -n my-app
  ./scripts/gen-pyproject.sh flutter -p . -n my-app -entry client
  ./scripts/gen-pyproject.sh flutter -p . -n my-app -d "My App scripts" -a "John <john@example.com>"
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=../common.sh
source "$SCRIPT_DIR/../common.sh"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""
NAME=""
ENTRY="app"
DESCRIPTION="Flutter project scripts"
AUTHOR=""

# First positional arg is framework
[ $# -ge 1 ] && [[ "$1" != -* ]] && { FRAMEWORK="$1"; shift; }

while [ $# -gt 0 ]; do
  case "$1" in
    -p)
      OUTPUT_DIR="${2:?-p requires a directory}"
      shift 2
      ;;
    -n)
      NAME="${2:?-n requires a name}"
      shift 2
      ;;
    -entry)
      ENTRY="${2:?-entry requires a directory}"
      shift 2
      ;;
    -d)
      DESCRIPTION="${2:?-d requires a description}"
      shift 2
      ;;
    -a)
      AUTHOR="${2:?-a requires an author}"
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
[ -z "$NAME" ] && { echo "Error: -n <name> is required" >&2; usage; }

# ─── Guardrail: -p must be a Flutter project root ───
jkit::ensure_flutter_root "$OUTPUT_DIR" "$ENTRY"

# ─── Normalize -p to absolute ───
OUTPUT_DIR="$(jkit::normalize_path "$OUTPUT_DIR")"

# ─── Build authors line ───
if [ -n "$AUTHOR" ]; then
  AUTHORS_LINE="authors = [\"$AUTHOR\"]"
else
  AUTHORS_LINE="authors = []"
fi

# ─── Generate pyproject.toml ───
DEST="$OUTPUT_DIR/pyproject.toml"

cat > "$DEST" <<TOML
[tool.poetry]
name = "$NAME"
version = "0.1.0"
description = "$DESCRIPTION"
$AUTHORS_LINE
package-mode = false

[tool.poetry.dependencies]
python = "^3.11"
ruamel-yaml = "^0.19.1"

[tool.poetry.group.dev.dependencies]
pre-commit = "^4.5.1"
pytest = "^8.3.5"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
TOML

echo "Generated: $DEST"
