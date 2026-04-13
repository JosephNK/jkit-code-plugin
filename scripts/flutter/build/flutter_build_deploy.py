#!/usr/bin/env python3
"""Flutter 앱 빌드 스크립트."""

import argparse
import subprocess
import sys
from pathlib import Path

# 지원하는 OS 및 Flavor
SUPPORTED_OS = ["aos", "ios"]
SUPPORTED_FLAVORS = ["appbundle", "production", "staging", "development", "qa"]


def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(description="Flutter 앱 빌드")
    parser.add_argument(
        "os",
        choices=SUPPORTED_OS,
        help="타겟 OS (aos: Android, ios: iOS)",
    )
    parser.add_argument(
        "flavor",
        help=f"빌드 flavor (예: {', '.join(SUPPORTED_FLAVORS)})",
    )
    parser.add_argument(
        "--no-tree-shake-icons",
        action="store_true",
        default=True,
        help="아이콘 tree-shake 비활성화 (기본값: True)",
    )
    parser.add_argument(
        "--export-options-plist",
        type=str,
        default=None,
        help="iOS export-options-plist 파일 경로 (예: ios/ExportOptions.plist)",
    )
    parser.add_argument(
        "--project-dir",
        type=str,
        required=True,
        help="프로젝트 루트 디렉토리",
    )
    return parser.parse_args()


def find_flutter_project_dir(project_root: Path) -> Path | None:
    """프로젝트 루트에서 Flutter 프로젝트 폴더를 찾습니다."""
    # 직접 pubspec.yaml이 있는 경우
    if (project_root / "pubspec.yaml").is_file() and (project_root / "lib").is_dir():
        return project_root

    # 하위 디렉토리에서 pubspec.yaml 찾기 (1단계만)
    for child in project_root.iterdir():
        if (
            child.is_dir()
            and (child / "pubspec.yaml").is_file()
            and (child / "lib").is_dir()
        ):
            return child

    return None


def build_android(flavor: str, tree_shake_icons: bool, cwd: Path) -> int:
    """Android 앱을 빌드합니다."""
    tree_shake_flag = [] if tree_shake_icons else ["--no-tree-shake-icons"]

    if flavor == "appbundle":
        print("Android AppBundle Production Building..")
        cmd = [
            "flutter",
            "build",
            "appbundle",
            *tree_shake_flag,
            "--flavor",
            "production",
        ]
    else:
        print(f"Android {flavor.capitalize()} Building..")
        cmd = ["flutter", "build", "apk", *tree_shake_flag, "--flavor", flavor]

    return run_command(cmd, cwd)


def build_ios(
    flavor: str,
    tree_shake_icons: bool,
    cwd: Path,
    export_options_plist: str | None = None,
) -> int:
    """iOS 앱을 빌드합니다."""
    tree_shake_flag = [] if tree_shake_icons else ["--no-tree-shake-icons"]

    if flavor == "appbundle":
        print("iOS AppBundle Production Not Support..")
        return 1

    print(f"iOS {flavor.capitalize()} Building..")
    cmd = ["flutter", "build", "ipa", *tree_shake_flag, "--flavor", flavor]

    if export_options_plist:
        cmd.extend(["--export-options-plist", export_options_plist])

    return run_command(cmd, cwd)


def run_command(cmd: list[str], cwd: Path) -> int:
    """명령어를 실행합니다."""
    try:
        result = subprocess.run(cmd, cwd=cwd, check=True)
        return result.returncode
    except subprocess.CalledProcessError as e:
        return e.returncode
    except FileNotFoundError:
        print("Error: flutter command not found.", file=sys.stderr)
        return 1


def main() -> int:
    """메인 함수."""
    args = parse_args()

    # Flutter 프로젝트 경로 결정
    project_root = Path(args.project_dir).resolve()
    flutter_dir = find_flutter_project_dir(project_root)

    if flutter_dir is None:
        print("Error: Flutter project not found", file=sys.stderr)
        return 1

    # 빌드 실행
    tree_shake_icons = not args.no_tree_shake_icons

    if args.os == "aos":
        result = build_android(args.flavor, tree_shake_icons, flutter_dir)
    else:
        result = build_ios(
            args.flavor, tree_shake_icons, flutter_dir, args.export_options_plist
        )

    if result == 0:
        print("Build Done")

    return result


if __name__ == "__main__":
    sys.exit(main())
