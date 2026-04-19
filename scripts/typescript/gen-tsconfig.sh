#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-tsconfig.sh <framework> -p <output-dir> [--with stack1,stack2,...]

Patches existing tsconfig.json with framework-specific settings.
If tsconfig.json does not exist, reports an error.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Project directory containing tsconfig.json (required)
  --with <list>  Comma-separated stack names (e.g. typeorm)

Examples:
  ./scripts/gen-tsconfig.sh nextjs -p ./my-project
  ./scripts/gen-tsconfig.sh nestjs -p ./my-project --with typeorm
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""
WITH_STACKS=""

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
    WITH_STACKS="${2:?--with requires a stack list}"
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

PATCH_FILE="$PLUGIN_ROOT/rules/$FRAMEWORK/base/tsconfig.patch.json"
TSCONFIG="$OUTPUT_DIR/tsconfig.json"

if [ ! -f "$PATCH_FILE" ]; then
  echo "Error: Patch file not found: $PATCH_FILE" >&2
  exit 1
fi

if [ ! -f "$TSCONFIG" ]; then
  echo "Error: tsconfig.json not found: $TSCONFIG" >&2
  echo "Run your framework's init command first (e.g. npx create-next-app, nest new)" >&2
  exit 1
fi

# ─── Collect patch files: base + stacks ───
PATCH_FILES=("$PATCH_FILE")

if [ -n "$WITH_STACKS" ]; then
  IFS=',' read -ra STACKS <<<"$WITH_STACKS"
  for STACK in "${STACKS[@]}"; do
    STACK_PATCH="$PLUGIN_ROOT/rules/$FRAMEWORK/$STACK/tsconfig.patch.json"
    if [ -f "$STACK_PATCH" ]; then
      PATCH_FILES+=("$STACK_PATCH")
    else
      echo "Warning: No tsconfig patch for stack '$STACK', skipping" >&2
    fi
  done
fi

# ─── Patch tsconfig.json using Node.js ───
# Pass patch file paths as JSON array
PATCH_FILES_JSON=$(printf '%s\n' "${PATCH_FILES[@]}" | node -e "
const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n');
process.stdout.write(JSON.stringify(lines));
")

node -e "
const fs = require('fs');
const path = require('path');

const patchFiles = $PATCH_FILES_JSON;
const tsconfig = JSON.parse(fs.readFileSync('$TSCONFIG', 'utf8'));
const dir = path.dirname('$TSCONFIG');

for (const patchFile of patchFiles) {
  const patch = JSON.parse(fs.readFileSync(patchFile, 'utf8'));

  // Deep merge compilerOptions
  if (patch.compilerOptions) {
    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    for (const [key, value] of Object.entries(patch.compilerOptions)) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        tsconfig.compilerOptions[key] = {
          ...tsconfig.compilerOptions[key],
          ...value
        };
      } else {
        tsconfig.compilerOptions[key] = value;
      }
    }
  }

  // Append to include array (deduplicated)
  if (patch.includeAdd && patch.includeAdd.length > 0) {
    tsconfig.include = tsconfig.include || [];
    for (const item of patch.includeAdd) {
      if (!tsconfig.include.includes(item)) {
        tsconfig.include.push(item);
      }
    }
  }

  // Create extra files
  if (patch.extraFiles) {
    for (const [filename, content] of Object.entries(patch.extraFiles)) {
      const filePath = path.join(dir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
        console.log('Created: ' + filePath);
      } else {
        console.log('Skipped (exists): ' + filePath);
      }
    }
  }
}

fs.writeFileSync('$TSCONFIG', JSON.stringify(tsconfig, null, 2) + '\n');
"

echo "Patched: $TSCONFIG"
