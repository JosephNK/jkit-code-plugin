#!/usr/bin/env python3
"""Flutter 다국어 리소스 빈 JSON 파일 생성 및 pubspec.yaml assets 등록 스크립트"""

import argparse
import re
import sys
from pathlib import Path

DEFAULT_LANGS = ["en-US", "ja-JP", "ko-KR"]
DEFAULT_LANGS_DIR = "assets/langs"
DEFAULT_PUBSPEC_FILE = "pubspec.yaml"
ASSETS_ENTRY = "assets/langs/"


def generate_lang_files(output_dir: str) -> list[str]:
    """다국어 리소스 빈 JSON 파일 생성

    Args:
        output_dir: 출력 디렉토리 경로

    Returns:
        생성된 파일 경로 목록
    """
    dir_path = Path(output_dir)
    dir_path.mkdir(parents=True, exist_ok=True)

    created: list[str] = []
    for lang in DEFAULT_LANGS:
        file_path = dir_path / f"{lang}.json"
        file_path.write_text("{}\n", encoding="utf-8")
        created.append(str(file_path))

    return created


def update_pubspec_assets(pubspec_path: str) -> bool:
    """pubspec.yaml의 flutter 섹션에 assets 항목 추가

    Args:
        pubspec_path: pubspec.yaml 경로

    Returns:
        수정 여부 (True: 수정됨, False: 이미 존재하거나 변경 불필요)
    """
    path = Path(pubspec_path)
    if not path.exists():
        print(f"Warning: {pubspec_path} not found", file=sys.stderr)
        return False

    content = path.read_text(encoding="utf-8")

    # 이미 assets/langs/ 항목이 있으면 스킵
    if ASSETS_ENTRY in content:
        return False

    # flutter: 섹션에서 uses-material-design: true 뒤에 assets 추가
    pattern = r"(  uses-material-design: true)\n"
    replacement = r"\1\n" "\n" "  assets:\n" f"    - {ASSETS_ENTRY}\n"

    updated = re.sub(pattern, replacement, content)
    if updated == content:
        print(
            "Warning: could not find insertion point in pubspec.yaml", file=sys.stderr
        )
        return False

    path.write_text(updated, encoding="utf-8")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Flutter 다국어 리소스 파일 생성 및 pubspec.yaml assets 등록",
    )
    parser.add_argument(
        "-entry",
        default="",
        help="엔트리 디렉토리 (예: app). 생략 시 assets/langs/, pubspec.yaml",
    )
    args = parser.parse_args()

    if args.entry:
        output_dir = f"{args.entry}/{DEFAULT_LANGS_DIR}"
        pubspec_path = f"{args.entry}/{DEFAULT_PUBSPEC_FILE}"
    else:
        output_dir = DEFAULT_LANGS_DIR
        pubspec_path = DEFAULT_PUBSPEC_FILE

    created = generate_lang_files(output_dir)
    for file_path in created:
        print(file_path)

    if update_pubspec_assets(pubspec_path):
        print(f"Updated {pubspec_path}: added assets entry")
    else:
        print(f"Skipped {pubspec_path}: assets entry already exists")


if __name__ == "__main__":
    main()
