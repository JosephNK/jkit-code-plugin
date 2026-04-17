#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers for jkit gen-*.sh scripts.
#
# Source this file from any gen-*.sh after setting `set -euo pipefail`:
#
#     SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#     source "$SCRIPT_DIR/common.sh"        # or "$SCRIPT_DIR/../common.sh"
#
# Provides:
#   jkit::normalize_path <path>        → echoes absolute path (path must exist)
#   jkit::ensure_git_repo <path>       → fails if <path> is not inside a git repo
#   jkit::ensure_flutter_root <root> <entry>
#                                       → fails unless <root>/<entry>/pubspec.yaml exists
# ─────────────────────────────────────────────────────────────────────────────

# Normalize a (possibly relative) path to an absolute canonical path.
# The path must already exist; otherwise prints an error and returns 1.
jkit::normalize_path() {
  local p="${1:?jkit::normalize_path requires a path}"
  if [ ! -e "$p" ]; then
    echo "Error: path does not exist: $p" >&2
    return 1
  fi
  (cd "$p" && pwd)
}

# Fail unless <path> (default: cwd) is the top level of a git repository,
# i.e. <path>/.git exists as a directory or file (worktree/submodule form).
# We deliberately do NOT use `git rev-parse --is-inside-work-tree` because that
# also succeeds from subdirectories — the whole point of this guardrail is to
# reject cases like running the script from `app/` when it belongs at the root.
jkit::ensure_git_repo() {
  local p="${1:-.}"
  if [ ! -e "$p" ]; then
    echo "Error: path does not exist: $p" >&2
    return 1
  fi
  if [ ! -e "$p/.git" ]; then
    echo "Error: $p is not a git repository root (missing $p/.git)" >&2
    echo "Hint: pass -p <project-root> or cd into the project root first." >&2
    return 1
  fi
}

# Fail unless <root>/<entry>/pubspec.yaml exists.
# Used by Flutter-specific generators to ensure -p really points at a Flutter
# project root (not an accidental subdir or unrelated dir).
jkit::ensure_flutter_root() {
  local root="${1:?jkit::ensure_flutter_root requires a project root}"
  local entry="${2:?jkit::ensure_flutter_root requires an entry dir}"
  local pubspec="$root/$entry/pubspec.yaml"
  if [ ! -f "$pubspec" ]; then
    echo "Error: $root is not a Flutter project root (missing $entry/pubspec.yaml)" >&2
    echo "Hint: pass -p <project-root> (and -entry <dir> if different from 'app')." >&2
    return 1
  fi
}
