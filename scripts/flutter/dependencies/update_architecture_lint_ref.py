#!/usr/bin/env python3
"""architecture_lint의 git ref 버전을 업데이트하는 스크립트."""

import argparse
import re
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(
        description="모든 pubspec.yaml에서 architecture_lint의 git ref를 업데이트합니다."
    )
    parser.add_argument(
        "ref",
        help="새로운 git ref 값 (예: v0.1.32, 0.1.32, main)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 변경 없이 변경될 내용만 출력합니다.",
    )
    parser.add_argument(
        "--project-dir",
        type=str,
        required=True,
        help="프로젝트 루트 디렉토리",
    )
    return parser.parse_args()


def normalize_ref(ref: str) -> str:
    """ref 값을 정규화합니다. 버전 형식이면 v 접두사를 붙입니다."""
    if ref.startswith("v") or not ref[0].isdigit():
        return ref
    return f"v{ref}"


def find_pubspec_files(project_root: Path) -> list[Path]:
    """프로젝트 내 모든 pubspec.yaml 파일을 찾습니다."""
    pubspec_files: list[Path] = []
    for pubspec in project_root.rglob("pubspec.yaml"):
        if any(part.startswith(".") or part == "build" for part in pubspec.parts):
            continue
        pubspec_files.append(pubspec)
    return sorted(pubspec_files)


def update_architecture_lint_ref(
    pubspec_path: Path, new_ref: str, dry_run: bool
) -> bool:
    """pubspec.yaml에서 architecture_lint의 ref를 업데이트합니다.

    architecture_lint의 git 블록은 url/path/ref 조합이며, 필드 순서는
    url → path → ref 가 일반적이지만 url → ref → path 케이스도 허용한다.

    Returns:
        True if updated, False if not found or unchanged.
    """
    content = pubspec_path.read_text(encoding="utf-8")

    # 공통 헤더: architecture_lint: \n  git: \n    url: ...
    header = r"(architecture_lint:\s*\n\s*git:\s*\n\s*url:[^\n]+\n)"

    # 케이스 1: path 가 ref 앞에 나오는 일반 순서
    pattern_path_first = (
        header + r"(\s*path:[^\n]+\n)(\s*ref:\s*)['\"]?([^'\"\n]+)['\"]?"
    )
    match = re.search(pattern_path_first, content)
    if match:
        old_ref = match.group(4)
        if old_ref == new_ref:
            print(f"  ⏭️  {pubspec_path}: 이미 동일한 ref ({old_ref})")
            return False
        new_content = re.sub(
            pattern_path_first,
            rf"\g<1>\g<2>\g<3>'{new_ref}'",
            content,
        )
    else:
        # 케이스 2: ref 만 있고 path 가 없거나 ref 가 앞에 있는 경우
        pattern_ref_only = header + r"(\s*ref:\s*)['\"]?([^'\"\n]+)['\"]?"
        match = re.search(pattern_ref_only, content)
        if not match:
            return False
        old_ref = match.group(3)
        if old_ref == new_ref:
            print(f"  ⏭️  {pubspec_path}: 이미 동일한 ref ({old_ref})")
            return False
        new_content = re.sub(
            pattern_ref_only,
            rf"\g<1>\g<2>'{new_ref}'",
            content,
        )

    if dry_run:
        print(f"  🔍 {pubspec_path}: {old_ref} → {new_ref} (dry-run)")
    else:
        pubspec_path.write_text(new_content, encoding="utf-8")
        print(f"  ✅ {pubspec_path}: {old_ref} → {new_ref}")

    return True


def main() -> int:
    """메인 함수."""
    args = parse_args()

    ref = normalize_ref(args.ref)
    project_root = Path(args.project_dir).resolve()

    print(f"프로젝트 루트: {project_root}")
    print(f"새 ref: {ref}")
    if args.dry_run:
        print("(dry-run 모드)")
    print()

    pubspec_files = find_pubspec_files(project_root)
    print(f"발견된 pubspec.yaml: {len(pubspec_files)}개\n")

    updated_count = 0
    for pubspec in pubspec_files:
        if update_architecture_lint_ref(pubspec, ref, args.dry_run):
            updated_count += 1

    print()
    if updated_count == 0:
        print("변경된 파일이 없습니다.")
    else:
        action = "변경 예정" if args.dry_run else "업데이트 완료"
        print(f"{updated_count}개 파일 {action}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
