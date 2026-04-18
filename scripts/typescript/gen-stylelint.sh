#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-stylelint.sh <framework> -p <output-dir>

Copies the framework's stylelint template to <output-dir>/stylelint.config.mjs
and patches <output-dir>/package.json with:
  - devDependencies: stylelint, stylelint-config-standard, @jkit/eslint-rules
  - scripts.lint:css
  - lint-staged glob for CSS files

Arguments:
  <framework>    Framework name (e.g. nextjs)

Options:
  -p <dir>       Output directory (required)

Examples:
  ./scripts/typescript/gen-stylelint.sh nextjs -p ./my-project
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""

[ $# -ge 1 ] && [[ "$1" != -* ]] && { FRAMEWORK="$1"; shift; }

while [ $# -gt 0 ]; do
  case "$1" in
    -p)
      OUTPUT_DIR="${2:?-p requires a directory}"
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

RULES_DIR="$PLUGIN_ROOT/rules/$FRAMEWORK"
TEMPLATE="$RULES_DIR/stylelint/stylelint.template.mjs"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: Stylelint template not found: $TEMPLATE" >&2
  exit 1
fi

# ─── Copy template to stylelint.config.mjs ───
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/stylelint.config.mjs"
cp "$TEMPLATE" "$OUTPUT_FILE"
echo "Generated: $OUTPUT_FILE"

# ─── Patch user's package.json ───
PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"
if [ ! -f "$PLUGIN_JSON" ]; then
  echo "Error: plugin.json not found at $PLUGIN_JSON" >&2
  exit 1
fi

PLUGIN_VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN_JSON'))['version'])")
GIT_REF="v$PLUGIN_VERSION"
GIT_DEP="github:JosephNK/jkit-code-plugin#$GIT_REF"

USER_PACKAGE_JSON="$OUTPUT_DIR/package.json"
if [ ! -f "$USER_PACKAGE_JSON" ]; then
  echo "Error: package.json not found at $USER_PACKAGE_JSON" >&2
  echo "Hint: run gen-eslint.sh first (which ensures package.json exists)." >&2
  exit 1
fi

python3 - "$USER_PACKAGE_JSON" "$GIT_DEP" <<'PY'
import json, sys, pathlib

pkg_path = pathlib.Path(sys.argv[1])
git_dep = sys.argv[2]

data = json.loads(pkg_path.read_text())

# ─── devDependencies ───
dev = data.setdefault("devDependencies", {})
dev_changes = []

def set_dep(name, version, label=None):
    label = label or name
    old = dev.get(name)
    dev[name] = version
    if old == version:
        dev_changes.append(f"  Unchanged: {label} ({version})")
    elif old:
        dev_changes.append(f"  Updated:   {label} {old} -> {version}")
    else:
        dev_changes.append(f"  Added:     {label} -> {version}")

# 최신 stylelint 16.x (Node 18+) — stylelint-config-standard 36.x이 16 호환
set_dep("stylelint", "^16.0.0")
set_dep("stylelint-config-standard", "^36.0.0")
# 토큰 하드코딩 차단용 (stylelint.base.mjs의 scale-unlimited/declaration-strict-value)
set_dep("stylelint-declaration-strict-value", "^1.10.0")
# @jkit/eslint-rules는 gen-eslint.sh가 먼저 넣어두지만 idempotent 보장 차원에서 동기화
set_dep("@jkit/eslint-rules", git_dep)

data["devDependencies"] = dict(sorted(dev.items()))

# ─── scripts.lint:css ───
scripts = data.setdefault("scripts", {})
css_glob = "**/*.{css,scss}"
css_cmd = f'stylelint "{css_glob}" --fix'
if "lint:css" not in scripts:
    scripts["lint:css"] = css_cmd
    script_note = f"  Added:     scripts.lint:css"
else:
    script_note = f"  Unchanged: scripts.lint:css (already defined)"

# ─── lint-staged ───
lint_staged = data.setdefault("lint-staged", {})
lint_glob = "*.{css,scss}"
lint_cmd = "stylelint --fix"

existing = lint_staged.get(lint_glob)
if existing is None:
    lint_staged[lint_glob] = lint_cmd
    ls_note = f"  Added:     lint-staged[{lint_glob!r}]"
elif isinstance(existing, str):
    if "stylelint" in existing:
        ls_note = f"  Unchanged: lint-staged[{lint_glob!r}] (stylelint already wired)"
    else:
        lint_staged[lint_glob] = [existing, lint_cmd]
        ls_note = f"  Merged:    lint-staged[{lint_glob!r}] with existing command"
elif isinstance(existing, list):
    if any("stylelint" in cmd for cmd in existing):
        ls_note = f"  Unchanged: lint-staged[{lint_glob!r}] (stylelint already wired)"
    else:
        lint_staged[lint_glob] = existing + [lint_cmd]
        ls_note = f"  Appended:  lint-staged[{lint_glob!r}]"
else:
    ls_note = f"  Skipped:   lint-staged[{lint_glob!r}] (unexpected type: {type(existing).__name__})"

pkg_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

for line in dev_changes:
    print(line)
print(script_note)
print(ls_note)
PY

echo ""
echo "Next step: run your package manager install in $OUTPUT_DIR"
