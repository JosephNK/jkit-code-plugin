#!/usr/bin/env python3
"""flutter_leaf_kit의 git ref 버전을 업데이트하는 스크립트."""

import argparse
import re
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(
        description="모든 pubspec.yaml에서 flutter_leaf_kit의 git ref를 업데이트합니다."
    )
    parser.add_argument(
        "ref",
        help="새로운 git ref 값 (예: v3.0.0, v3.0.0-dev, main)",
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
    # 이미 v로 시작하거나, 브랜치명(main, develop 등)이면 그대로 반환
    if ref.startswith("v") or not ref[0].isdigit():
        return ref
    # 숫자로 시작하면 버전으로 간주하고 v 접두사 추가
    return f"v{ref}"


def find_pubspec_files(project_root: Path) -> list[Path]:
    """프로젝트 내 모든 pubspec.yaml 파일을 찾습니다."""
    pubspec_files = []
    for pubspec in project_root.rglob("pubspec.yaml"):
        # .dart_tool, build 등 제외
        if any(part.startswith(".") or part == "build" for part in pubspec.parts):
            continue
        pubspec_files.append(pubspec)
    return sorted(pubspec_files)


def update_leaf_kit_ref(pubspec_path: Path, new_ref: str, dry_run: bool) -> bool:
    """pubspec.yaml에서 flutter_leaf_kit의 ref를 업데이트합니다.

    Returns:
        True if updated, False if not found or unchanged.
    """
    content = pubspec_path.read_text(encoding="utf-8")

    # flutter_leaf_kit git dependency 패턴 매칭
    # ref: 'v3.0.0-dev' 또는 ref: "v3.0.0-dev" 또는 ref: v3.0.0-dev
    pattern = r"(flutter_leaf_kit:\s*\n\s*git:\s*\n\s*url:[^\n]+\n\s*ref:\s*)['\"]?([^'\"\n]+)['\"]?"

    match = re.search(pattern, content)
    if not match:
        return False

    old_ref = match.group(2)
    if old_ref == new_ref:
        print(f"  ⏭️  {pubspec_path}: 이미 동일한 ref ({old_ref})")
        return False

    # 새 ref로 교체 (따옴표 스타일 유지)
    new_content = re.sub(
        pattern,
        rf"\g<1>'{new_ref}'",
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

    # ref 정규화 (3.0.0-dev → v3.0.0-dev)
    ref = normalize_ref(args.ref)

    # 프로젝트 루트 경로 결정
    project_root = Path(args.project_dir).resolve()

    print(f"프로젝트 루트: {project_root}")
    print(f"새 ref: {ref}")
    if args.dry_run:
        print("(dry-run 모드)")
    print()

    # pubspec.yaml 파일 찾기
    pubspec_files = find_pubspec_files(project_root)
    print(f"발견된 pubspec.yaml: {len(pubspec_files)}개\n")

    updated_count = 0
    for pubspec in pubspec_files:
        if update_leaf_kit_ref(pubspec, ref, args.dry_run):
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
