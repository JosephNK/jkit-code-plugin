#!/usr/bin/env python3
"""Keystore 정보 조회 스크립트."""

import argparse
import subprocess
import sys
from pathlib import Path

def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(description="Keystore 정보 조회")
    parser.add_argument(
        "keystore",
        help="키스토어 파일 경로 (예: my-release-key.keystore)",
    )
    parser.add_argument(
        "--project-dir",
        required=True,
        help="프로젝트 루트 디렉토리",
    )
    return parser.parse_args()


def find_android_dir(project_root: Path) -> Path | None:
    """프로젝트 루트에서 android 폴더를 찾습니다."""
    # 직접 android 폴더가 있는 경우
    if (project_root / "android").is_dir():
        return project_root / "android"

    # 하위 디렉토리에서 android 폴더 찾기 (1단계만)
    for child in project_root.iterdir():
        if child.is_dir() and (child / "android").is_dir():
            return child / "android"

    return None


def main() -> int:
    """키스토어 정보를 출력합니다."""
    args = parse_args()

    # 키스토어 경로 결정
    keystore_path = Path(args.keystore)
    if not keystore_path.is_absolute():
        # 상대 경로인 경우 프로젝트 루트 기준으로 android 폴더를 찾아서 설정
        project_root = Path(args.project_dir)
        android_dir = find_android_dir(project_root)

        if android_dir is None:
            print("Error: android directory not found in project", file=sys.stderr)
            return 1

        keystore_path = android_dir / args.keystore

    if not keystore_path.exists():
        print(f"Error: Keystore not found at {keystore_path}", file=sys.stderr)
        return 1

    cmd = [
        "keytool",
        "-list",
        "-keystore",
        str(keystore_path),
        "-v",
    ]

    try:
        result = subprocess.run(cmd, check=True)
        return result.returncode
    except subprocess.CalledProcessError as e:
        return e.returncode
    except FileNotFoundError:
        print(
            "Error: keytool command not found. Please ensure JDK is installed.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
