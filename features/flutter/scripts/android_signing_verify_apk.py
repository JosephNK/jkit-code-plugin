#!/usr/bin/env python3
"""APK 서명 검증 스크립트."""

import argparse
import subprocess
import sys
from pathlib import Path

# 기본값 설정
DEFAULT_APK = "build/app/outputs/flutter-apk/app.apk"


def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(description="APK 서명 검증")
    parser.add_argument(
        "apk",
        nargs="?",
        default=DEFAULT_APK,
        help=f"APK 파일 경로 (기본값: {DEFAULT_APK})",
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


def find_flutter_project_dir(project_root: Path) -> Path | None:
    """프로젝트 루트에서 Flutter 프로젝트 폴더를 찾습니다."""
    # 직접 pubspec.yaml이 있는 경우
    if (project_root / "pubspec.yaml").is_file():
        return project_root

    # 하위 디렉토리에서 pubspec.yaml 찾기 (1단계만)
    for child in project_root.iterdir():
        if child.is_dir() and (child / "pubspec.yaml").is_file():
            return child

    return None


def main() -> int:
    """APK 서명을 검증합니다."""
    args = parse_args()

    # APK 경로 결정
    apk_path = Path(args.apk)
    if not apk_path.is_absolute():
        # 상대 경로인 경우 Flutter 프로젝트 폴더 기준으로 설정
        script_dir = Path(__file__).resolve().parent
        project_root = script_dir.parent.parent
        flutter_dir = find_flutter_project_dir(project_root)

        if flutter_dir is None:
            print("Error: Flutter project not found", file=sys.stderr)
            return 1

        apk_path = flutter_dir / args.apk

    if not apk_path.exists():
        print(f"Error: APK not found at {apk_path}", file=sys.stderr)
        return 1

    cmd = [
        "apksigner",
        "verify",
        "--print-certs",
        str(apk_path),
    ]

    try:
        result = subprocess.run(cmd, check=True)
        return result.returncode
    except subprocess.CalledProcessError as e:
        return e.returncode
    except FileNotFoundError:
        print(
            "Error: apksigner command not found. Please ensure Android SDK build-tools is installed.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
