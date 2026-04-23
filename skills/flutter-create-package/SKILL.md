---
name: flutter-create-package
description: Creates a new Flutter package in the monorepo with workspace integration. Use for requests like "Create a new package", "Add network package".
argument-hint: "<package_name> [-entry <dir>] [--with-leaf-kit] [--leaf-kit-ref <ref>] [--no-app-dep]"
---

# Flutter Package Creation Skill

Creates a new Flutter package in the monorepo and integrates it with the Dart workspace.

## Arguments

- First value of `$ARGUMENTS`: Package name (required, snake_case, e.g. myapp_network)
- `-entry <dir>`: Entry directory (optional, default: `app`). Leaf-kit ref 자동 추출 및 패키지 의존성 등록 시 참조
- `--with-leaf-kit`: Add flutter_leaf_kit git dependency to the package (optional)
- `--leaf-kit-ref <ref>`: Specify leaf-kit git ref (optional, v prefix auto-added). If omitted, extracts from entry's pubspec.yaml
- `--no-app-dep`: Skip adding dependency to entry's pubspec.yaml (optional)

## Workflow

1. **Parse arguments**: Extract package name and options from `$ARGUMENTS`
2. **Execute script**:
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && node scripts/flutter/create/flutter-create-package.mjs <package_name> [-entry <dir>] [--with-leaf-kit] [--leaf-kit-ref <ref>] [--no-app-dep]
   ```
3. **Verify results**: Check script output for errors
4. **Report**: Display summary of created/modified files

## What the Script Does (Idempotent)

| Step | Action | Skip condition |
|------|--------|----------------|
| 1 | `flutter create --template=package` in `packages/` | Directory already exists |
| 2 | Add `publish_to: 'none'` + `resolution: workspace` to package pubspec.yaml | Already set |
| 3 | Add `packages/<name>` to root pubspec.yaml workspace list | Already registered |
| 4 | Add `flutter_leaf_kit` git dependency to package pubspec.yaml | Already exists (or `--with-leaf-kit` 없음) |
| 5 | Add `<name>: any` to entry's pubspec.yaml dependencies | Already registered (or `--no-app-dep`) |
| 6 | Run `flutter pub get` | No changes made |

## Usage Examples

```
/flutter-create-package myapp_network -entry app --with-leaf-kit
→ packages/myapp_network/ 생성
→ resolution: workspace 추가
→ 루트 workspace 등록
→ flutter_leaf_kit 의존성 추가 (ref: app/pubspec.yaml에서 자동 추출)
→ app dependencies 등록
→ flutter pub get 실행

/flutter-create-package myapp_network --with-leaf-kit
→ -entry 생략 시 기본값 app 사용 (위와 동일)

/flutter-create-package myapp_auth --with-leaf-kit --leaf-kit-ref 4.0.5-dev
→ flutter_leaf_kit ref를 v4.0.5-dev로 설정 (v 자동 추가)

/flutter-create-package myapp_utils --no-app-dep
→ flutter_leaf_kit 의존성 생략
→ entry dependencies 생략
```

## Notes

- Idempotent: 이미 존재하는 패키지에 실행해도 누락된 설정만 추가
- 전부 완료 상태면 "이미 설정 완료 상태입니다" 출력 후 종료
- `-entry` 생략 시 기본값 `app` 사용
- `--leaf-kit-ref` 생략 시 엔트리 디렉토리의 pubspec.yaml에서 현재 ref 자동 추출
- `--leaf-kit-ref`에 버전 앞 v 생략 가능 (자동으로 v 접두사 추가)
- `--dry-run` 옵션으로 미리보기 가능 (스크립트 직접 실행 시)
