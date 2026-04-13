#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-pyproject.sh flutter -p <output-dir> -n <name> [-d <description>] [-a <author>]

Generates pyproject.toml for a Flutter project.

Arguments:
  flutter          Framework name (currently flutter only)

Options:
  -p <dir>         Output directory (required)
  -n <name>        Project name (required, e.g. my-app)
  -d <description> Project description (default: "Flutter project scripts")
  -a <author>      Author (default: empty, e.g. "Name <email>")

Examples:
  ./scripts/gen-pyproject.sh flutter -p . -n my-app
  ./scripts/gen-pyproject.sh flutter -p . -n my-app -d "My App scripts" -a "John <john@example.com>"
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""
NAME=""
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
packages = [{include = "scripts"}]
package-mode = false

[tool.poetry.dependencies]
python = "^3.11"

[tool.poetry.group.dev.dependencies]
pre-commit = "^4.5.1"
pytest = "^8.3.5"

[tool.poetry.scripts]
update-leaf-kit-ref = "scripts.update_leaf_kit_ref:main"
update-deps = "scripts.update_dependencies:main"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
TOML

echo "Generated: $DEST"
