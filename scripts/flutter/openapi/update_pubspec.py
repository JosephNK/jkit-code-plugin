#!/usr/bin/env python3
"""패키지 pubspec.yaml에 BuiltValue 의존성을 자동 추가하는 스크립트.

built_value, built_collection (dependencies)과
build_runner, built_value_generator (dev_dependencies)를 추가합니다.
멱등성 보장: 이미 있으면 스킵합니다.
"""

import re
import sys
from pathlib import Path

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

DEPENDENCIES = {
    "built_value": "^8.12.3",
    "built_collection": "^5.1.1",
}

DEV_DEPENDENCIES = {
    "build_runner": "^2.4.15",
    "built_value_generator": "^8.12.3",
}


# ──────────────────────────────────────────────
# YAML text manipulation helpers
# ──────────────────────────────────────────────


def _find_block_last_entry(content: str, block_name: str) -> int:
    """지정된 블록의 마지막 항목 인덱스를 반환합니다."""
    lines = content.split("\n")
    in_block = False
    last_entry_idx = -1

    for i, line in enumerate(lines):
        if re.match(rf"^{block_name}:", line):
            in_block = True
            continue
        if in_block:
            if line.startswith("  "):
                last_entry_idx = i
            elif line.strip() and not line.startswith(" "):
                break

    return last_entry_idx


def _has_dependency(content: str, dep_name: str) -> bool:
    """의존성이 이미 존재하는지 확인합니다."""
    return bool(re.search(rf"^\s+{re.escape(dep_name)}:", content, re.MULTILINE))


def _add_dependency(content: str, block_name: str, dep_name: str, version: str) -> str:
    """의존성을 블록에 추가합니다."""
    last_idx = _find_block_last_entry(content, block_name)
    if last_idx == -1:
        return content

    lines = content.split("\n")
    lines.insert(last_idx + 1, f"  {dep_name}: {version}")
    return "\n".join(lines)


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────


def update_pubspec(pubspec_path: Path, dry_run: bool = False) -> bool:
    """pubspec.yaml에 BuiltValue 관련 의존성을 추가합니다.

    Args:
        pubspec_path: pubspec.yaml 파일 경로.
        dry_run: True이면 미리보기만.

    Returns:
        True if any change was made.
    """
    if not pubspec_path.exists():
        print(f"Error: {pubspec_path} not found", file=sys.stderr)
        return False

    content = pubspec_path.read_text(encoding="utf-8")
    original = content
    added: list[str] = []

    # dependencies 추가
    for dep, version in DEPENDENCIES.items():
        if _has_dependency(content, dep):
            print(f"  Skip: {dep} (already present)")
            continue
        if dry_run:
            print(f"  [dry-run] Would add {dep}: {version} to dependencies")
            added.append(dep)
        else:
            content = _add_dependency(content, "dependencies", dep, version)
            added.append(dep)

    # dev_dependencies 추가
    for dep, version in DEV_DEPENDENCIES.items():
        if _has_dependency(content, dep):
            print(f"  Skip: {dep} (already present)")
            continue
        if dry_run:
            print(f"  [dry-run] Would add {dep}: {version} to dev_dependencies")
            added.append(dep)
        else:
            content = _add_dependency(content, "dev_dependencies", dep, version)
            added.append(dep)

    if not added:
        print("  All dependencies already present.")
        return False

    if not dry_run and content != original:
        pubspec_path.write_text(content, encoding="utf-8")
        print(f"  Added {len(added)} dependencies: {', '.join(added)}")

    return True


def main() -> int:
    """CLI 진입점."""
    if len(sys.argv) < 2:
        print("Usage: update_pubspec.py <pubspec_path> [--dry-run]", file=sys.stderr)
        return 1

    pubspec_path = Path(sys.argv[1])
    dry_run = "--dry-run" in sys.argv

    update_pubspec(pubspec_path, dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
