#!/usr/bin/env python3
"""Inject architecture_lint into pubspec.yaml and analysis_options.yaml.

Uses ruamel.yaml for round-trip YAML editing — preserves comments,
formatting, and existing structure.

architecture_lint is injected as a git dependency so the generated
pubspec.yaml is portable across developer machines and CI.

Usage:
    poetry run python3 inject_architecture_lint.py \
        --pubspec app/pubspec.yaml \
        --analysis-options app/analysis_options.yaml \
        --git-url https://github.com/JosephNK/jkit-code-plugin.git \
        --git-path rules/flutter/custom-lint/architecture_lint \
        --git-ref v0.1.28
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ruamel.yaml import YAML

PACKAGE_NAME = "architecture_lint"


def _build_git_dep(url: str, path: str, ref: str) -> dict:
    return {"git": {"url": url, "path": path, "ref": ref}}


# ─── pubspec.yaml ───


def inject_pubspec(
    pubspec_path: Path, git_url: str, git_path: str, git_ref: str
) -> bool:
    """Add architecture_lint as git dev_dependency to pubspec.yaml."""
    if not pubspec_path.is_file():
        print(f"Error: {pubspec_path} not found", file=sys.stderr)
        return False

    yaml = YAML()
    yaml.preserve_quotes = True

    data = yaml.load(pubspec_path)
    if data is None:
        print(f"Error: {pubspec_path} is empty", file=sys.stderr)
        return False

    if "dev_dependencies" not in data:
        data["dev_dependencies"] = {}

    if data["dev_dependencies"] is None:
        data["dev_dependencies"] = {}

    desired = _build_git_dep(git_url, git_path, git_ref)
    current = data["dev_dependencies"].get(PACKAGE_NAME)

    if (
        isinstance(current, dict)
        and isinstance(current.get("git"), dict)
        and current["git"].get("url") == git_url
        and current["git"].get("path") == git_path
        and current["git"].get("ref") == git_ref
    ):
        print(f"  {PACKAGE_NAME} already pinned to {git_ref} in {pubspec_path}")
        return True

    data["dev_dependencies"][PACKAGE_NAME] = desired

    with open(pubspec_path, "w") as f:
        yaml.dump(data, f)

    print(f"  Injected {PACKAGE_NAME} (git ref {git_ref}) into {pubspec_path}")
    return True


# ─── analysis_options.yaml ───


def inject_analysis_options(analysis_path: Path) -> bool:
    """Add architecture_lint plugin to analysis_options.yaml."""
    yaml = YAML()
    yaml.preserve_quotes = True

    if analysis_path.is_file():
        data = yaml.load(analysis_path)
    else:
        data = None

    if data is None:
        data = {}

    if "analyzer" not in data:
        data["analyzer"] = {}

    if data["analyzer"] is None:
        data["analyzer"] = {}

    plugins = data["analyzer"].get("plugins")

    if plugins is None:
        data["analyzer"]["plugins"] = [PACKAGE_NAME]
    elif isinstance(plugins, list):
        if PACKAGE_NAME in plugins:
            print(f"  {PACKAGE_NAME} already in {analysis_path}, skipping")
            return True
        plugins.append(PACKAGE_NAME)
    else:
        if str(plugins) == PACKAGE_NAME:
            print(f"  {PACKAGE_NAME} already in {analysis_path}, skipping")
            return True
        data["analyzer"]["plugins"] = [plugins, PACKAGE_NAME]

    with open(analysis_path, "w") as f:
        yaml.dump(data, f)

    print(f"  Injected {PACKAGE_NAME} into {analysis_path}")
    return True


# ─── Main ───


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inject architecture_lint into Flutter project config"
    )
    parser.add_argument("--pubspec", required=True, help="Path to pubspec.yaml")
    parser.add_argument(
        "--analysis-options",
        required=True,
        help="Path to analysis_options.yaml",
    )
    parser.add_argument(
        "--git-url",
        required=True,
        help="Git repository URL for architecture_lint",
    )
    parser.add_argument(
        "--git-path",
        required=True,
        help="Path to architecture_lint package within the repo",
    )
    parser.add_argument(
        "--git-ref",
        required=True,
        help="Git ref (tag recommended, e.g. v0.1.28)",
    )
    args = parser.parse_args()

    print(f"Injecting {PACKAGE_NAME}...")

    ok = True
    ok = (
        inject_pubspec(Path(args.pubspec), args.git_url, args.git_path, args.git_ref)
        and ok
    )
    ok = inject_analysis_options(Path(args.analysis_options)) and ok

    if ok:
        print("Done.")
    else:
        print("Completed with errors.", file=sys.stderr)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
