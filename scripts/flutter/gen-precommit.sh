#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ───
usage() {
  cat <<'EOF'
Usage: gen-precommit.sh flutter -p <output-dir> [-entry <dir>]

Generates .pre-commit-config.yaml for a Flutter project.

Arguments:
  flutter        Framework name (currently flutter only)

Options:
  -p <dir>       Output directory (required)
  -entry <dir>   Entry directory (default: app)

Examples:
  ./scripts/gen-precommit.sh flutter -p .
  ./scripts/gen-precommit.sh flutter -p . -entry app
  ./scripts/gen-precommit.sh flutter -p . -entry client
EOF
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Parse arguments ───
FRAMEWORK=""
OUTPUT_DIR=""
ENTRY="app"

# First positional arg is framework
[ $# -ge 1 ] && [[ "$1" != -* ]] && { FRAMEWORK="$1"; shift; }

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

[ -z "$FRAMEWORK" ] && { echo "Error: framework is required" >&2; usage; }
[ -z "$OUTPUT_DIR" ] && { echo "Error: -p <output-dir> is required" >&2; usage; }

# ─── Generate .pre-commit-config.yaml ───
DEST="$OUTPUT_DIR/.pre-commit-config.yaml"

cat > "$DEST" <<YAML
repos:
  # 공통 검사 (trailing whitespace, EOF, YAML)
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml

  # Dart format & Flutter analyze + test (local hooks)
  - repo: local
    hooks:
      - id: dart-format
        name: dart format
        entry: dart format
        language: system
        types: [file]
        files: \\.dart\$

      - id: architecture-lint
        name: architecture lint
        entry: poetry run python ${PLUGIN_ROOT}/rules/flutter/custom-lint/architecture-lint.py ${ENTRY}
        language: system
        pass_filenames: false
        types: [file]
        files: \\.dart\$

      - id: flutter-analyze
        name: flutter analyze
        entry: bash -c 'cd ${ENTRY} && flutter analyze --fatal-infos'
        language: system
        pass_filenames: false
        types: [file]
        files: \\.dart\$

      - id: flutter-test
        name: flutter test (related only)
        entry: bash -c 'cd ${ENTRY} && tf=\$(git diff --cached --name-only --diff-filter=ACMR | grep "^${ENTRY}/.*\\.dart\$" | sed "s|^${ENTRY}/||" | while read f; do if [[ \$f == test/*_test.dart ]]; then echo \$f; elif [[ \$f == lib/* ]]; then t=test/\${f#lib/}; t=\${t%.dart}_test.dart; [ -f "\$t" ] && echo \$t; fi; done | sort -u) && if [ -n "\$tf" ]; then flutter test \$tf; else echo "No related tests found, skipping"; fi'
        language: system
        pass_filenames: false
        types: [file]
        files: \\.dart\$

  # Conventional commit 검증
  - repo: https://github.com/compilerla/conventional-pre-commit
    rev: v4.3.0
    hooks:
      - id: conventional-pre-commit
        stages: [commit-msg]
        args: [feat, fix, refactor, docs, test, chore, perf, ci]
YAML

echo "Generated: $DEST (entry: $ENTRY)"
