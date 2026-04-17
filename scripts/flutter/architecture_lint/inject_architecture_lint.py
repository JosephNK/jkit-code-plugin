#!/usr/bin/env python3
"""Inject architecture_lint into pubspec.yaml and analysis_options.yaml.

Uses ruamel.yaml for round-trip YAML editing — preserves comments,
formatting, and existing structure.

Usage:
    poetry run python3 inject_architecture_lint.py \
        --pubspec app/pubspec.yaml \
        --analysis-options app/analysis_options.yaml \
        --lint-path /path/to/architecture_lint
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ruamel.yaml import YAML

PACKAGE_NAME = "architecture_lint"


# ─── pubspec.yaml ───


def inject_pubspec(pubspec_path: Path, lint_path: str) -> bool:
    """Add architecture_lint as dev_dependency to pubspec.yaml."""
    if not pubspec_path.is_file():
        print(f"Error: {pubspec_path} not found", file=sys.stderr)
        return False

    yaml = YAML()
    yaml.preserve_quotes = True

    data = yaml.load(pubspec_path)
    if data is None:
        print(f"Error: {pubspec_path} is empty", file=sys.stderr)
        return False

    # Ensure dev_dependencies section exists
    if "dev_dependencies" not in data:
        data["dev_dependencies"] = {}

    if data["dev_dependencies"] is None:
        data["dev_dependencies"] = {}

    # Idempotent: skip if already present
    if PACKAGE_NAME in data["dev_dependencies"]:
        print(f"  {PACKAGE_NAME} already in {pubspec_path}, skipping")
        return True

    data["dev_dependencies"][PACKAGE_NAME] = {"path": lint_path}

    with open(pubspec_path, "w") as f:
        yaml.dump(data, f)

    print(f"  Injected {PACKAGE_NAME} into {pubspec_path}")
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

    # Ensure analyzer section exists
    if "analyzer" not in data:
        data["analyzer"] = {}

    if data["analyzer"] is None:
        data["analyzer"] = {}

    plugins = data["analyzer"].get("plugins")

    if plugins is None:
        # No plugins yet — create list
        data["analyzer"]["plugins"] = [PACKAGE_NAME]
    elif isinstance(plugins, list):
        # Already a list — append if not present
        if PACKAGE_NAME in plugins:
            print(f"  {PACKAGE_NAME} already in {analysis_path}, skipping")
            return True
        plugins.append(PACKAGE_NAME)
    else:
        # Scalar value — convert to list
        if str(plugins) == PACKAGE_NAME:
            print(f"  {PACKAGE_NAME} already in {analysis_path}, skipping")
            return True
        data["analyzer"]["plugins"] = [plugins, PACKAGE_NAME]

    with open(analysis_path, "w") as f:
        yaml.dump(data, f)

    print(f"  Injected {PACKAGE_NAME} into {analysis_path}")
    return True


# ─── tools/analyzer_plugin/pubspec.yaml ───


def fix_bootstrap_pubspec(lint_path: str) -> bool:
    """Rewrite architecture_lint's tools/analyzer_plugin/pubspec.yaml so
    its path dependency points to an absolute location.

    Dart analyzer copies only tools/analyzer_plugin/ into
    ~/.dartServer/.plugin_manager/<hash>/analyzer_plugin/ before running,
    breaking any relative 'path: ../../' reference. Replace with the
    absolute $LINT_PATH so resolution survives the copy.
    """
    bootstrap = Path(lint_path) / "tools" / "analyzer_plugin" / "pubspec.yaml"
    if not bootstrap.is_file():
        print(f"  Warning: {bootstrap} not found, skipping", file=sys.stderr)
        return True  # non-fatal: plugin may not have bootstrap

    yaml = YAML()
    yaml.preserve_quotes = True
    data = yaml.load(bootstrap)

    if data is None:
        return True

    deps = data.get("dependencies")
    if not isinstance(deps, dict) or PACKAGE_NAME not in deps:
        return True

    current = deps[PACKAGE_NAME]
    desired = {"path": lint_path}

    if isinstance(current, dict) and current.get("path") == lint_path:
        print(f"  {bootstrap} already uses absolute path, skipping")
        return True

    deps[PACKAGE_NAME] = desired

    with open(bootstrap, "w") as f:
        yaml.dump(data, f)

    print(f"  Patched {bootstrap}")
    return True


# ─── Main ───


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inject architecture_lint into Flutter project config"
    )
    parser.add_argument(
        "--pubspec",
        required=True,
        help="Path to pubspec.yaml",
    )
    parser.add_argument(
        "--analysis-options",
        required=True,
        help="Path to analysis_options.yaml",
    )
    parser.add_argument(
        "--lint-path",
        required=True,
        help="Absolute path to architecture_lint package",
    )
    args = parser.parse_args()

    print(f"Injecting {PACKAGE_NAME}...")

    ok = True
    ok = inject_pubspec(Path(args.pubspec), args.lint_path) and ok
    ok = inject_analysis_options(Path(args.analysis_options)) and ok
    ok = fix_bootstrap_pubspec(args.lint_path) and ok

    if ok:
        print("Done.")
    else:
        print("Completed with errors.", file=sys.stderr)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
