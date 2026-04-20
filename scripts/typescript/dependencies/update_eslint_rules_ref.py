#!/usr/bin/env python3
"""@jkit/eslint-rules의 git ref 버전을 package.json 전반에서 업데이트하는 스크립트."""

import argparse
import json
import re
import sys
from pathlib import Path

PACKAGE_NAME = "@jkit/eslint-rules"
GIT_PREFIX = "github:JosephNK/jkit-code-plugin#"
SKIP_DIR_NAMES = {"node_modules", "build", "dist", ".next", ".turbo", ".cache"}


def parse_args() -> argparse.Namespace:
    """CLI 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(
        description=(
            "모든 package.json에서 @jkit/eslint-rules의 git ref를 업데이트합니다."
        )
    )
    parser.add_argument(
        "ref",
        nargs="?",
        default=None,
        help=(
            "새로운 git ref 값 (예: v0.1.55, 0.1.55, main). "
            "생략 시 plugin.json의 현재 버전을 사용합니다."
        ),
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


def resolve_plugin_version() -> str:
    """`.claude-plugin/plugin.json`에서 현재 플러그인 버전을 읽어 v 접두사를 붙입니다."""
    plugin_json = Path(__file__).resolve().parents[3] / ".claude-plugin" / "plugin.json"
    if not plugin_json.is_file():
        raise SystemExit(f"plugin.json을 찾을 수 없습니다: {plugin_json}")
    try:
        data = json.loads(plugin_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"plugin.json 파싱 실패: {exc}") from exc
    version = data.get("version")
    if not isinstance(version, str) or not version:
        raise SystemExit("plugin.json의 version 필드가 비어 있습니다.")
    return normalize_ref(version)


def find_package_jsons(project_root: Path) -> list[Path]:
    """프로젝트 내 모든 package.json 파일을 찾습니다."""
    results: list[Path] = []
    for pkg in project_root.rglob("package.json"):
        if any(
            part in SKIP_DIR_NAMES or part.startswith(".") and part != "."
            for part in pkg.relative_to(project_root).parts[:-1]
        ):
            continue
        results.append(pkg)
    return sorted(results)


def update_section(
    section: dict[str, str], new_value: str
) -> tuple[bool, str | None]:
    """deps 섹션에서 PACKAGE_NAME의 값을 new_value로 교체합니다.

    Returns:
        (changed, old_value). 존재하지 않으면 (False, None).
    """
    if PACKAGE_NAME not in section:
        return (False, None)
    old = section[PACKAGE_NAME]
    if old == new_value:
        return (False, old)
    section[PACKAGE_NAME] = new_value
    return (True, old)


def update_package_json(pkg_path: Path, new_ref: str, dry_run: bool) -> bool:
    """package.json에서 @jkit/eslint-rules의 git ref를 업데이트합니다."""
    raw = pkg_path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"  ⚠️  {pkg_path}: JSON 파싱 실패 ({exc})")
        return False

    new_value = f"{GIT_PREFIX}{new_ref}"
    changed_any = False
    old_values: list[str] = []

    for key in ("dependencies", "devDependencies", "peerDependencies"):
        section = data.get(key)
        if not isinstance(section, dict):
            continue
        changed, old = update_section(section, new_value)
        if old is not None and not changed:
            old_values.append(old)
        if changed:
            changed_any = True
            if old is not None:
                old_values.append(old)

    if not changed_any:
        if old_values:
            print(f"  ⏭️  {pkg_path}: 이미 동일한 ref ({old_values[0]})")
        return False

    old_repr = old_values[0] if old_values else "(none)"
    if dry_run:
        print(f"  🔍 {pkg_path}: {old_repr} → {new_value} (dry-run)")
    else:
        # 들여쓰기는 원본 감지가 복잡하므로 관례적으로 2-space 사용
        indent = detect_indent(raw)
        trailing_newline = "\n" if raw.endswith("\n") else ""
        pkg_path.write_text(
            json.dumps(data, indent=indent, ensure_ascii=False) + trailing_newline,
            encoding="utf-8",
        )
        print(f"  ✅ {pkg_path}: {old_repr} → {new_value}")

    return True


def detect_indent(raw: str) -> int:
    """원본 JSON의 첫 들여쓰기를 추정합니다. 실패 시 2."""
    match = re.search(r"\n( +)\"", raw)
    if not match:
        return 2
    return len(match.group(1))


def main() -> int:
    """메인 함수."""
    args = parse_args()

    if args.ref is None:
        ref = resolve_plugin_version()
        ref_source = "plugin.json 자동 감지"
    else:
        ref = normalize_ref(args.ref)
        ref_source = "CLI 인자"
    project_root = Path(args.project_dir).resolve()

    print(f"프로젝트 루트: {project_root}")
    print(f"새 ref: {ref} ({ref_source})")
    if args.dry_run:
        print("(dry-run 모드)")
    print()

    pkg_files = find_package_jsons(project_root)
    print(f"발견된 package.json: {len(pkg_files)}개\n")

    updated = 0
    for pkg in pkg_files:
        if update_package_json(pkg, ref, args.dry_run):
            updated += 1

    print()
    if updated == 0:
        print("변경된 파일이 없습니다.")
    else:
        action = "변경 예정" if args.dry_run else "업데이트 완료"
        print(f"{updated}개 파일 {action}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
