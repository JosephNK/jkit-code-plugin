#!/usr/bin/env python3
"""Flutter 모노레포에서 새 패키지를 생성하고 workspace에 통합하는 스크립트.

멱등성(idempotent) 보장: 이미 존재하는 패키지에 대해 실행해도
누락된 설정만 추가하고, 모두 완료 상태이면 안전하게 종료합니다.

YAML 쓰기는 텍스트 기반 삽입을 사용하여 기존 포맷(주석, 들여쓰기, 빈 줄)을 보존합니다.
ruamel.yaml은 구조 확인(read-only)에만 사용합니다.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

from ruamel.yaml import YAML

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

PACKAGE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")

DART_RESERVED_WORDS = frozenset({
    "abstract", "as", "assert", "async", "await", "break", "case", "catch",
    "class", "const", "continue", "covariant", "default", "deferred", "do",
    "dynamic", "else", "enum", "export", "extends", "extension", "external",
    "factory", "false", "final", "finally", "for", "function", "get", "hide",
    "if", "implements", "import", "in", "interface", "is", "late", "library",
    "mixin", "new", "null", "on", "operator", "part", "required", "rethrow",
    "return", "set", "show", "static", "super", "switch", "sync", "this",
    "throw", "true", "try", "typedef", "var", "void", "while", "with", "yield",
})


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(
        description="Flutter 모노레포에서 새 패키지를 생성하고 workspace에 통합합니다.",
    )
    parser.add_argument(
        "package_name",
        help="패키지 이름 (snake_case, 예: myapp_network)",
    )
    parser.add_argument(
        "-entry",
        type=str,
        default="app",
        help="엔트리 디렉토리 (기본값: app). "
        "이 디렉토리의 pubspec.yaml에 패키지 의존성을 추가하고, "
        "leaf-kit ref 자동 추출 시 참조합니다.",
    )
    parser.add_argument(
        "--no-app-dep",
        action="store_true",
        help="엔트리 디렉토리의 pubspec.yaml에 의존성을 추가하지 않습니다.",
    )
    parser.add_argument(
        "--with-leaf-kit",
        action="store_true",
        help="flutter_leaf_kit git 의존성을 패키지에 추가합니다.",
    )
    parser.add_argument(
        "--leaf-kit-ref",
        type=str,
        default=None,
        help="flutter_leaf_kit git ref (예: v4.0.5-dev, 4.0.5-dev). "
        "생략 시 엔트리 디렉토리의 pubspec.yaml에서 자동 추출합니다. "
        "버전 앞에 v 생략 가능 (자동으로 v 접두사 추가).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 변경 없이 변경될 내용만 출력합니다.",
    )
    return parser.parse_args()


# ──────────────────────────────────────────────
# Validation
# ──────────────────────────────────────────────


def validate_package_name(name: str) -> None:
    """패키지명이 Dart 패키지 규칙에 맞는지 검증합니다.

    Raises:
        SystemExit: 유효하지 않은 패키지명일 때.
    """
    if not PACKAGE_NAME_PATTERN.match(name):
        print(
            f"❌ 유효하지 않은 패키지명: '{name}'\n"
            "   → snake_case (소문자 + 숫자 + 언더스코어, 소문자로 시작)",
            file=sys.stderr,
        )
        sys.exit(1)

    if name in DART_RESERVED_WORDS:
        print(
            f"❌ Dart 예약어는 패키지명으로 사용할 수 없습니다: '{name}'",
            file=sys.stderr,
        )
        sys.exit(1)


# ──────────────────────────────────────────────
# Ref helpers
# ──────────────────────────────────────────────


_LEAF_KIT_REF_PATTERN = re.compile(
    r"flutter_leaf_kit:\s*\n\s*git:\s*\n\s*url:[^\n]+\n\s*ref:\s*['\"]?([^'\"\n]+)['\"]?"
)

LEAF_KIT_GIT_URL = "https://github.com/JosephNK/flutter_leaf_kit.git"
LEAF_KIT_GIT_PATH = "./packages/leaf"


def normalize_ref(ref: str) -> str:
    """ref 값을 정규화합니다. 버전 형식이면 v 접두사를 붙입니다."""
    if ref.startswith("v") or not ref[0].isdigit():
        return ref
    return f"v{ref}"


def extract_leaf_kit_ref(project_root: Path, entry: str) -> str:
    """엔트리 디렉토리의 pubspec.yaml에서 flutter_leaf_kit의 현재 git ref를 추출합니다.

    Raises:
        SystemExit: pubspec.yaml이 없거나 flutter_leaf_kit 의존성을 찾을 수 없을 때.
    """
    entry_pubspec = project_root / entry / "pubspec.yaml"

    if not entry_pubspec.exists():
        print(
            f"❌ {entry}/pubspec.yaml을 찾을 수 없어 leaf-kit ref를 추출할 수 없습니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    content = entry_pubspec.read_text(encoding="utf-8")
    match = _LEAF_KIT_REF_PATTERN.search(content)

    if not match:
        print(
            f"❌ {entry}/pubspec.yaml에서 flutter_leaf_kit git ref를 찾을 수 없습니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    return match.group(1)


# ──────────────────────────────────────────────
# YAML read-only helper
# ──────────────────────────────────────────────


def _read_yaml(path: Path) -> dict:
    """YAML 파일을 파싱하여 dict로 반환합니다 (read-only)."""
    yaml = YAML()
    yaml.preserve_quotes = True
    return yaml.load(path)


# ──────────────────────────────────────────────
# Text-based YAML insertion helpers
# ──────────────────────────────────────────────


def _insert_line_after(content: str, anchor_pattern: str, new_line: str) -> str:
    """anchor_pattern에 매칭되는 마지막 줄 바로 뒤에 new_line을 삽입합니다."""
    lines = content.split("\n")
    insert_idx = -1

    for i, line in enumerate(lines):
        if re.match(anchor_pattern, line):
            insert_idx = i

    if insert_idx == -1:
        raise ValueError(f"앵커 패턴을 찾을 수 없습니다: {anchor_pattern}")

    lines.insert(insert_idx + 1, new_line)
    return "\n".join(lines)


def _find_last_workspace_entry(content: str) -> int:
    """workspace: 블록의 마지막 '  - ...' 항목의 인덱스를 반환합니다."""
    lines = content.split("\n")
    in_workspace = False
    last_entry_idx = -1

    for i, line in enumerate(lines):
        if re.match(r"^workspace:", line):
            in_workspace = True
            continue
        if in_workspace:
            if re.match(r"^  - ", line):
                last_entry_idx = i
            elif line.strip() and not line.startswith(" "):
                # workspace 블록을 벗어남
                break

    return last_entry_idx


def _find_last_dependency_entry(content: str) -> int:
    """dependencies: 블록의 마지막 항목 인덱스를 반환합니다.

    단순 'key: value' 뿐 아니라 다중 줄 의존성(git 등)도 처리합니다.
    """
    lines = content.split("\n")
    in_deps = False
    last_entry_idx = -1

    for i, line in enumerate(lines):
        if re.match(r"^dependencies:", line):
            in_deps = True
            continue
        if in_deps:
            # 2-space 들여쓰기가 있는 줄은 dependencies 블록 내부
            if line.startswith("  "):
                last_entry_idx = i
            elif line.strip() and not line.startswith(" "):
                # dependencies 블록을 벗어남
                break

    return last_entry_idx


# ──────────────────────────────────────────────
# Step functions
# ──────────────────────────────────────────────


def create_flutter_package(
    project_root: Path,
    package_name: str,
    dry_run: bool,
) -> bool:
    """flutter create --template=package 실행.

    Returns:
        True if created, False if already exists.
    """
    packages_dir = project_root / "packages"
    package_dir = packages_dir / package_name

    if package_dir.exists():
        print(f"  ⏭️  packages/{package_name}/ 이미 존재 (스킵)")
        return False

    if dry_run:
        print(f"  🔍 packages/{package_name}/ 생성 예정 (dry-run)")
        return True

    packages_dir.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        ["flutter", "create", "--template=package", package_name],
        cwd=packages_dir,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"❌ flutter create 실패:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    print(f"  ✅ packages/{package_name}/ 생성 완료")
    return True


def setup_package_pubspec(
    project_root: Path,
    package_name: str,
    dry_run: bool,
) -> bool:
    """패키지 pubspec.yaml에 publish_to: 'none'과 resolution: workspace 추가.

    Returns:
        True if any change was made, False if all already present.
    """
    pubspec_path = project_root / "packages" / package_name / "pubspec.yaml"

    if not pubspec_path.exists():
        if dry_run:
            print("  🔍 publish_to + resolution: workspace 추가 예정 (dry-run)")
            return True
        print(
            f"❌ {pubspec_path} 파일을 찾을 수 없습니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    data = _read_yaml(pubspec_path)
    has_publish_to = data.get("publish_to") is not None
    has_resolution = data.get("resolution") == "workspace"

    if has_publish_to and has_resolution:
        print("  ⏭️  publish_to + resolution: workspace 이미 설정됨 (스킵)")
        return False

    if dry_run:
        missing = []
        if not has_publish_to:
            missing.append("publish_to: 'none'")
        if not has_resolution:
            missing.append("resolution: workspace")
        print(f"  🔍 {' + '.join(missing)} 추가 예정 (dry-run)")
        return True

    content = pubspec_path.read_text(encoding="utf-8")

    # publish_to: 'none' 추가 (description: 뒤에 삽입)
    if not has_publish_to:
        for anchor in (r"^description:.*",):
            try:
                content = _insert_line_after(content, anchor, "publish_to: 'none'")
                break
            except ValueError:
                continue
        else:
            content = content.replace("version:", "publish_to: 'none'\nversion:")

    # resolution: workspace 추가 (homepage: 뒤에 삽입)
    if not has_resolution:
        for anchor in (r"^homepage:.*", r"^publish_to:.*", r"^version:.*"):
            try:
                content = _insert_line_after(content, anchor, "resolution: workspace")
                break
            except ValueError:
                continue
        else:
            content = content.replace(
                "environment:", "resolution: workspace\n\nenvironment:"
            )

    pubspec_path.write_text(content, encoding="utf-8")

    added = []
    if not has_publish_to:
        added.append("publish_to: 'none'")
    if not has_resolution:
        added.append("resolution: workspace")
    print(f"  ✅ {' + '.join(added)} 추가")
    return True


def add_to_root_workspace(
    project_root: Path,
    package_name: str,
    dry_run: bool,
) -> bool:
    """루트 pubspec.yaml의 workspace 목록에 패키지 추가.

    Returns:
        True if added, False if already present.
    """
    root_pubspec = project_root / "pubspec.yaml"
    content = root_pubspec.read_text(encoding="utf-8")
    workspace_entry = f"packages/{package_name}"

    # 텍스트에서 직접 존재 여부 체크
    if f"  - {workspace_entry}" in content:
        print("  ⏭️  루트 workspace에 이미 등록됨 (스킵)")
        return False

    if dry_run:
        print(f"  🔍 루트 workspace에 '{workspace_entry}' 추가 예정 (dry-run)")
        return True

    last_idx = _find_last_workspace_entry(content)
    if last_idx == -1:
        print("❌ 루트 pubspec.yaml에서 workspace 블록을 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)

    lines = content.split("\n")
    lines.insert(last_idx + 1, f"  - {workspace_entry}")
    content = "\n".join(lines)

    root_pubspec.write_text(content, encoding="utf-8")
    print("  ✅ 루트 workspace에 등록")
    return True


def add_to_entry_dependencies(
    project_root: Path,
    package_name: str,
    entry: str,
    dry_run: bool,
) -> bool:
    """엔트리 디렉토리의 pubspec.yaml dependencies에 패키지 추가.

    Returns:
        True if added, False if already present.
    """
    entry_pubspec = project_root / entry / "pubspec.yaml"

    if not entry_pubspec.exists():
        print(f"  ⚠️  {entry}/pubspec.yaml을 찾을 수 없습니다 (스킵)")
        return False

    content = entry_pubspec.read_text(encoding="utf-8")

    # 텍스트에서 직접 존재 여부 체크
    if re.search(rf"^\s+{re.escape(package_name)}:", content, re.MULTILINE):
        print(f"  ⏭️  {entry} dependencies에 이미 등록됨 (스킵)")
        return False

    if dry_run:
        print(f"  🔍 {entry} dependencies에 '{package_name}: any' 추가 예정 (dry-run)")
        return True

    last_idx = _find_last_dependency_entry(content)
    if last_idx == -1:
        print(
            f"❌ {entry}/pubspec.yaml에서 dependencies 블록을 찾을 수 없습니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    lines = content.split("\n")
    # 빈 줄 + 패키지 추가
    lines.insert(last_idx + 1, "")
    lines.insert(last_idx + 2, f"  {package_name}: any")
    content = "\n".join(lines)

    entry_pubspec.write_text(content, encoding="utf-8")
    print(f"  ✅ {entry} dependencies에 등록")
    return True


def add_leaf_kit_dependency(
    project_root: Path,
    package_name: str,
    ref: str,
    dry_run: bool,
) -> bool:
    """패키지 pubspec.yaml에 flutter_leaf_kit git 의존성을 추가합니다.

    Returns:
        True if added, False if already present.
    """
    pubspec_path = project_root / "packages" / package_name / "pubspec.yaml"

    if not pubspec_path.exists():
        if dry_run:
            print("  🔍 flutter_leaf_kit 의존성 추가 예정 (dry-run)")
            return True
        print(f"❌ {pubspec_path} 파일을 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)

    content = pubspec_path.read_text(encoding="utf-8")

    # 이미 flutter_leaf_kit 의존성이 있는지 체크
    if re.search(r"^\s+flutter_leaf_kit:", content, re.MULTILINE):
        print("  ⏭️  flutter_leaf_kit 의존성 이미 존재 (스킵)")
        return False

    if dry_run:
        print(f"  🔍 flutter_leaf_kit (ref: '{ref}') 의존성 추가 예정 (dry-run)")
        return True

    last_idx = _find_last_dependency_entry(content)
    if last_idx == -1:
        print(
            "❌ 패키지 pubspec.yaml에서 dependencies 블록을 찾을 수 없습니다.",
            file=sys.stderr,
        )
        sys.exit(1)

    leaf_kit_block = (
        "",
        "  # flutter_leaf_kit",
        "  flutter_leaf_kit:",
        "    git:",
        f"      url: {LEAF_KIT_GIT_URL}",
        f"      ref: '{ref}'",
        f"      path: {LEAF_KIT_GIT_PATH}",
    )

    lines = content.split("\n")
    for offset, line in enumerate(leaf_kit_block):
        lines.insert(last_idx + 1 + offset, line)
    content = "\n".join(lines)

    pubspec_path.write_text(content, encoding="utf-8")
    print(f"  ✅ flutter_leaf_kit (ref: '{ref}') 의존성 추가")
    return True


def run_pub_get(project_root: Path, dry_run: bool) -> bool:
    """flutter pub get 실행.

    Returns:
        True if executed, False if dry-run.
    """
    if dry_run:
        print("  🔍 flutter pub get 실행 예정 (dry-run)")
        return False

    result = subprocess.run(
        ["flutter", "pub", "get"],
        cwd=project_root,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"⚠️  flutter pub get 경고:\n{result.stderr}", file=sys.stderr)
        return False

    print("  ✅ flutter pub get 완료")
    return True


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────


def main() -> int:
    """메인 함수."""
    args = parse_args()
    package_name = args.package_name
    entry = args.entry
    dry_run = args.dry_run
    no_app_dep = args.no_app_dep
    with_leaf_kit = args.with_leaf_kit
    leaf_kit_ref_arg = args.leaf_kit_ref

    # 프로젝트 루트 경로 결정 (.claude/scripts/flutter/create/ → 4단계 상위)
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent.parent

    # 유효성 검증
    validate_package_name(package_name)

    # leaf-kit ref 결정
    leaf_kit_ref: str | None = None
    if with_leaf_kit:
        if leaf_kit_ref_arg:
            leaf_kit_ref = normalize_ref(leaf_kit_ref_arg)
        else:
            leaf_kit_ref = extract_leaf_kit_ref(project_root, entry)

    print(f"📦 패키지: {package_name}")
    print(f"   entry: {entry}")
    if with_leaf_kit:
        print(f"   leaf-kit ref: {leaf_kit_ref}")
    if dry_run:
        print("   (dry-run 모드)\n")
    else:
        print()

    changes: list[bool] = []

    # Step 1: 패키지 생성
    changes.append(create_flutter_package(project_root, package_name, dry_run))

    # Step 2: publish_to + resolution: workspace 추가
    if not dry_run and not (project_root / "packages" / package_name).exists():
        print("❌ 패키지 디렉토리가 없어 설정을 진행할 수 없습니다.", file=sys.stderr)
        return 1
    changes.append(setup_package_pubspec(project_root, package_name, dry_run))

    # Step 3: 루트 workspace 등록
    changes.append(add_to_root_workspace(project_root, package_name, dry_run))

    # Step 4: flutter_leaf_kit 의존성 추가
    if with_leaf_kit:
        changes.append(
            add_leaf_kit_dependency(project_root, package_name, leaf_kit_ref, dry_run)
        )
    else:
        print("  ⏭️  flutter_leaf_kit 의존성 생략 (--with-leaf-kit 없음)")

    # Step 5: 엔트리 dependencies 등록
    if no_app_dep:
        print(f"  ⏭️  {entry} dependencies 등록 생략 (--no-app-dep)")
    else:
        changes.append(
            add_to_entry_dependencies(project_root, package_name, entry, dry_run)
        )

    # Step 6: flutter pub get (변경 사항이 있을 때만)
    print()
    has_changes = any(changes)

    if has_changes:
        run_pub_get(project_root, dry_run)
        change_count = sum(1 for c in changes if c)
        action = "변경 예정" if dry_run else "설정 완료"
        print(f"\n{change_count}개 {action}")
    else:
        print("이미 설정 완료 상태입니다.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
