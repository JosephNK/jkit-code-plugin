#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-eslint.sh <framework> -p <output-dir> [--with stack1,stack2,...]

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Output directory (required)
  --with <list>  Comma-separated stacks (e.g. mantine,nextauth,tanstack-query)

Examples:
  ./scripts/gen-eslint.sh nextjs -p ./my-project --with mantine,nextauth,tanstack-query
  ./scripts/gen-eslint.sh nextjs -p ./my-project
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""
STACKS=""

# First positional arg is framework
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

RULES_DIR="$PLUGIN_ROOT/rules/$FRAMEWORK"
TEMPLATE="$RULES_DIR/base/eslint.template.mjs"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: Template not found: $TEMPLATE" >&2
  exit 1
fi

# ─── Parse manifest sections ───
parse_section() {
  local manifest="$1"
  local section="$2"
  awk -v sec="$section" '
    /^--- .+ ---$/ {
      current = $0
      gsub(/^--- | ---$/, "", current)
      found = (current == sec)
      next
    }
    found { print }
  ' "$manifest"
}

# ─── Collect snippets from all stacks ───
IMPORTS=""
RESTRICTED=""
DOMAIN=""
SYNTAX=""
ELEMENTS=""
RULES=""
PATCHES=""
IGNORES=""
FRAMEWORK=""
INFRA=""
CUSTOM=""

if [ -n "$STACKS" ]; then
  IFS=',' read -ra STACK_LIST <<<"$STACKS"
  IFS=$'\n' STACK_LIST=($(sort <<<"${STACK_LIST[*]}"))
  unset IFS
  for stack in "${STACK_LIST[@]}"; do
    stack=$(echo "$stack" | xargs) # trim whitespace
    MANIFEST="$RULES_DIR/$stack/eslint.manifest"

    if [ ! -f "$MANIFEST" ]; then
      echo "Warning: Manifest not found for stack '$stack': $MANIFEST" >&2
      continue
    fi

    section_content=$(parse_section "$MANIFEST" "import")
    [ -n "$section_content" ] && IMPORTS="${IMPORTS}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "restricted")
    [ -n "$section_content" ] && RESTRICTED="${RESTRICTED}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "domain")
    [ -n "$section_content" ] && DOMAIN="${DOMAIN}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "syntax")
    [ -n "$section_content" ] && SYNTAX="${SYNTAX}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "elements")
    [ -n "$section_content" ] && ELEMENTS="${ELEMENTS}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "rules")
    [ -n "$section_content" ] && RULES="${RULES}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "patches")
    [ -n "$section_content" ] && PATCHES="${PATCHES}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "ignores")
    [ -n "$section_content" ] && IGNORES="${IGNORES}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "framework")
    [ -n "$section_content" ] && FRAMEWORK="${FRAMEWORK}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "infra")
    [ -n "$section_content" ] && INFRA="${INFRA}${section_content}"$'\n'

    section_content=$(parse_section "$MANIFEST" "custom")
    [ -n "$section_content" ] && CUSTOM="${CUSTOM}${section_content}"$'\n'
  done
fi

# ─── Generate eslint.config.mjs from template ───
OUTPUT_FILE="$OUTPUT_DIR/eslint.config.mjs"

# Read template and replace markers
content=$(<"$TEMPLATE")

replace_marker() {
  local marker="$1"
  local value="$2"
  # Remove trailing newline from value
  value=$(echo -n "$value" | sed '/^$/d')
  if [ -n "$value" ]; then
    local tmpfile
    tmpfile=$(mktemp)
    echo -n "$value" >"$tmpfile"
    local result=""
    while IFS= read -r line; do
      if [[ "$line" == *"$marker"* ]]; then
        result+=$(<"$tmpfile")$'\n'
      else
        result+="$line"$'\n'
      fi
    done <<<"$content"
    content="$result"
    rm -f "$tmpfile"
  else
    # Remove marker line if no content
    local result=""
    while IFS= read -r line; do
      [[ "$line" == *"$marker"* ]] || result+="$line"$'\n'
    done <<<"$content"
    content="$result"
  fi
}

replace_marker "// {{STACK_IMPORTS}}" "$IMPORTS"
replace_marker "// {{RESTRICTED_PATTERNS}}" "$RESTRICTED"
replace_marker "// {{DOMAIN_BANNED}}" "$DOMAIN"
replace_marker "// {{RESTRICTED_SYNTAX}}" "$SYNTAX"
replace_marker "// {{BOUNDARY_ELEMENTS}}" "$ELEMENTS"
replace_marker "// {{BOUNDARY_RULES}}" "$RULES"
replace_marker "// {{BOUNDARY_PATCHES}}" "$PATCHES"
replace_marker "// {{BOUNDARY_IGNORES}}" "$IGNORES"
replace_marker "// {{FRAMEWORK_PACKAGES}}" "$FRAMEWORK"
replace_marker "// {{INFRA_PACKAGES}}" "$INFRA"
replace_marker "// {{CUSTOM_CONFIG}}" "$CUSTOM"

# Remove trailing blank lines
while [[ "$content" == *$'\n'$'\n' ]]; do
  content="${content%$'\n'}"
done
mkdir -p "$OUTPUT_DIR"
echo "$content" >"$OUTPUT_FILE"
echo "Generated: $OUTPUT_FILE"

# ─── Patch user's package.json with git dependency ───
# Resolve current plugin version from .claude-plugin/plugin.json
PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"
if [ ! -f "$PLUGIN_JSON" ]; then
  echo "Error: plugin.json not found at $PLUGIN_JSON" >&2
  exit 1
fi

PLUGIN_VERSION=$(python3 -c "import json,sys; print(json.load(open('$PLUGIN_JSON'))['version'])")
GIT_REF="v$PLUGIN_VERSION"
GIT_DEP="github:JosephNK/jkit-code-plugin#$GIT_REF"

USER_PACKAGE_JSON="$OUTPUT_DIR/package.json"
if [ ! -f "$USER_PACKAGE_JSON" ]; then
  echo "Error: package.json not found at $USER_PACKAGE_JSON" >&2
  echo "Hint: run 'npm init -y' in the project root first." >&2
  exit 1
fi

python3 - "$USER_PACKAGE_JSON" "$GIT_DEP" <<'PY'
import json, sys, pathlib

pkg_path = pathlib.Path(sys.argv[1])
git_dep = sys.argv[2]

data = json.loads(pkg_path.read_text())
dev = data.setdefault("devDependencies", {})

old = dev.get("@jkit/eslint-rules")
dev["@jkit/eslint-rules"] = git_dep

# Sort devDependencies alphabetically to keep diffs minimal
data["devDependencies"] = dict(sorted(dev.items()))

pkg_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

if old == git_dep:
    print(f"  Unchanged: @jkit/eslint-rules ({git_dep})")
elif old:
    print(f"  Updated:   @jkit/eslint-rules {old} → {git_dep}")
else:
    print(f"  Added:     @jkit/eslint-rules → {git_dep}")
PY

echo ""
echo "Next step: run 'npm install' in $OUTPUT_DIR"

if [ -n "$STACKS" ]; then
  echo "Stacks: $STACKS"
fi
