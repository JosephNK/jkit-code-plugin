#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: ./deploy.sh [<version>|patch|minor|major] [--yes]

Bumps the plugin version, commits, tags, and pushes in one shot.

Updates:
  - .claude-plugin/plugin.json            (version)
  - .claude-plugin/marketplace.json       (version)
  - rules/flutter/custom-lint/architecture_lint/tools/analyzer_plugin/pubspec.yaml
    (architecture_lint git ref → v<new-version>)

Then:
  - git add + commit "chore: 버전 <new> 범프"
  - git tag v<new>
  - git push origin <branch> --follow-tags

Arguments:
  <version>  Explicit version (e.g. 0.1.28)
  patch      Increment patch (0.1.27 → 0.1.28) [default]
  minor      Increment minor (0.1.27 → 0.2.0)
  major      Increment major (0.1.27 → 1.0.0)

Options:
  --yes    Skip confirmation prompt
  -h       Show this help

Examples:
  ./deploy.sh
  ./deploy.sh patch
  ./deploy.sh 0.1.28
  ./deploy.sh minor --yes
EOF
  exit 1
}

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ─── Parse arguments ───
BUMP="patch"
EXPLICIT_VERSION=""
YES="false"

while [ $# -gt 0 ]; do
  case "$1" in
  patch | minor | major)
    BUMP="$1"
    shift
    ;;
  --yes | -y)
    YES="true"
    shift
    ;;
  -h | --help)
    usage
    ;;
  [0-9]*.[0-9]*.[0-9]*)
    EXPLICIT_VERSION="$1"
    shift
    ;;
  *)
    echo "Unknown argument: $1" >&2
    usage
    ;;
  esac
done

# ─── Safety checks ───
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree has uncommitted changes. Commit or stash first." >&2
  git status --short >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "Warning: current branch is '$BRANCH', not 'main'."
  if [ "$YES" != "true" ]; then
    read -r -p "Continue anyway? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || exit 1
  fi
fi

# ─── Resolve current version ───
CURRENT=$(python3 -c "import json; print(json.load(open('.claude-plugin/plugin.json'))['version'])")
echo "Current version: $CURRENT"

# ─── Compute new version ───
if [ -n "$EXPLICIT_VERSION" ]; then
  NEW="$EXPLICIT_VERSION"
else
  IFS='.' read -r MAJ MIN PAT <<<"$CURRENT"
  case "$BUMP" in
  patch) PAT=$((PAT + 1)) ;;
  minor)
    MIN=$((MIN + 1))
    PAT=0
    ;;
  major)
    MAJ=$((MAJ + 1))
    MIN=0
    PAT=0
    ;;
  esac
  NEW="${MAJ}.${MIN}.${PAT}"
fi

TAG="v${NEW}"

if [ "$NEW" = "$CURRENT" ]; then
  echo "Error: new version equals current version ($CURRENT)" >&2
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag $TAG already exists" >&2
  exit 1
fi

echo "New version:     $NEW"
echo "New tag:         $TAG"

# ─── Show changes since last release ───
LAST_TAG=$(git tag --list 'v*' --sort=-v:refname | head -1 || true)

echo ""
if [ -n "$LAST_TAG" ]; then
  RANGE="$LAST_TAG..HEAD"
  echo "─── Commits since $LAST_TAG ───"
else
  RANGE="HEAD"
  echo "─── All commits (no previous tag) ───"
fi

COMMITS=$(git log --pretty=format:'  %h %s' "$RANGE" 2>/dev/null || true)
if [ -z "$COMMITS" ]; then
  echo "  (no new commits)"
else
  echo "$COMMITS"
fi

echo ""
echo "─── Files changed ───"
FILES=$(git diff --stat "$RANGE" 2>/dev/null | tail -n +1 || true)
if [ -z "$FILES" ]; then
  echo "  (no file changes)"
else
  echo "$FILES" | sed 's/^/  /'
fi

echo ""
echo "─── Release actions ───"
echo "  1. Update .claude-plugin/plugin.json            → $NEW"
echo "  2. Update .claude-plugin/marketplace.json       → $NEW"
echo "  3. Update package.json                          → $NEW"
echo "  4. Update tools/analyzer_plugin/pubspec.yaml    → ref: $TAG"
echo "  5. git commit -m \"chore: 버전 $NEW 범프\""
echo "  6. git tag $TAG"
echo "  7. git push origin $BRANCH --follow-tags"
echo ""

if [ "$YES" != "true" ]; then
  read -r -p "Proceed with release? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || {
    echo "Aborted."
    exit 1
  }
fi

# ─── Update version files ───
PLUGIN_JSON=".claude-plugin/plugin.json"
MARKETPLACE_JSON=".claude-plugin/marketplace.json"
ROOT_PACKAGE_JSON="package.json"
BOOTSTRAP_PUBSPEC="rules/flutter/custom-lint/architecture_lint/tools/analyzer_plugin/pubspec.yaml"

python3 <<PY
import json, re, pathlib

new = "$NEW"

for path in ("$PLUGIN_JSON", "$MARKETPLACE_JSON", "$ROOT_PACKAGE_JSON"):
    p = pathlib.Path(path)
    if not p.exists():
        print(f"  Skipped {path} (not found)")
        continue
    data = json.loads(p.read_text())
    if "version" in data:
        data["version"] = new
    if "plugins" in data and isinstance(data["plugins"], list):
        for plugin in data["plugins"]:
            if plugin.get("name") == "jkit":
                plugin["version"] = new
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"  Updated {path}")

# Bootstrap pubspec ref (plain text replace to preserve YAML formatting)
bp = pathlib.Path("$BOOTSTRAP_PUBSPEC")
txt = bp.read_text()
new_txt = re.sub(r"(ref:\s*)v[0-9]+\.[0-9]+\.[0-9]+", rf"\1v{new}", txt, count=1)
if new_txt == txt:
    raise SystemExit("Failed to update ref in $BOOTSTRAP_PUBSPEC")
bp.write_text(new_txt)
print(f"  Updated $BOOTSTRAP_PUBSPEC (ref → v{new})")
PY

# ─── Commit + tag + push ───
git add "$PLUGIN_JSON" "$MARKETPLACE_JSON" "$BOOTSTRAP_PUBSPEC"
[ -f "$ROOT_PACKAGE_JSON" ] && git add "$ROOT_PACKAGE_JSON"
git commit -m "chore: 버전 ${NEW} 범프"
git tag -a "$TAG" -m "Release $TAG"

echo ""
echo "Pushing commit and tag..."
git push origin "$BRANCH" --follow-tags

echo ""
echo "✓ Released $TAG"
