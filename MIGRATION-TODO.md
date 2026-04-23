# Shell/Python → Node.js(.mjs) 변환 TODO

> 기존 `.sh` / `.py` 스크립트를 Node.js ESM(`.mjs`)로 이전하는 작업의 잔여 리스트.
> 진행 상황: 이전에 shell 15종, typescript 3종, `update_eslint_rules_ref.py`, `deploy.sh` 완료.

---

## 1. Python 파일 — 플러그인 소유 (총 32개)

### `scripts/flutter/` (31개)

| 디렉토리 | 파일 수 | 파일 |
|---|---|---|
| `architecture_lint/` | 0 | ~~`inject_architecture_lint.py`~~ ✅ 완료 (inject-architecture-lint.mjs) |
| `build/` | 0 | ~~`flutter_build_deploy.py`~~ ✅ 완료 (flutter-build-deploy.mjs) |
| `create/` | 0 | ~~`flutter_create_package.py`~~ ✅ (flutter-create-package.mjs) |
| `dependencies/` | 0 | ~~`update_architecture_lint_ref.py`~~ ✅ (update-architecture-lint-ref.mjs), ~~`update_dependencies.py`~~ ✅ (update-dependencies.mjs), ~~`update_leaf_kit_ref.py`~~ ✅ (update-leaf-kit-ref.mjs) |
| `keystore/` | 0 | ~~`android_show_info_keystore.py`~~ ✅ (android-show-info-keystore.mjs), ~~`android_signing_report_keystore.py`~~ ✅ (android-signing-report-keystore.mjs), ~~`android_signing_verify_apk.py`~~ ✅ (android-signing-verify-apk.mjs) |
| `openapi/` | 0 | ~~`__init__.py`~~ ✅, ~~`_run.py`~~ ✅ (generate-api.mjs가 CLI 역할 흡수), ~~`dart_name_utils.py`~~ ✅ (dart-name-utils.mjs), ~~`generate_api.py`~~ ✅ (generate-api.mjs), ~~`openapi_parser.py`~~ ✅ (openapi-parser.mjs), ~~`update_pubspec.py`~~ ✅ (update-pubspec.mjs) |
| `setup/` | 0 | ~~`flutter_android_manifest_setup.py`~~ ✅ (flutter-android-manifest-setup.mjs), ~~`flutter_assets_lang_setup.py`~~ ✅ (flutter-assets-lang-setup.mjs), ~~`flutter_ios_info_plist_setup.py`~~ ✅ (flutter-ios-info-plist-setup.mjs), ~~`flutter_route_setup.py`~~ ✅ (flutter-route-setup.mjs) |
| `template/` | 0 | ~~`flutter_app_template.py`~~ ✅, ~~`flutter_app_bar_template.py`~~ ✅, ~~`flutter_bloc_template.py`~~ ✅, ~~`flutter_body_view_template.py`~~ ✅, ~~`flutter_di_template.py`~~ ✅, ~~`flutter_main_template.py`~~ ✅, ~~`flutter_route_template.py`~~ ✅, ~~`flutter_screen_template.py`~~ ✅, ~~`flutter_android_build_gradle_template.py`~~ ✅, ~~`flutter_android_proguard_template.py`~~ ✅, ~~`flutter_ios_pbxproj_template.py`~~ ✅, ~~`flutter_ios_xcscheme_template.py`~~ ✅ (모두 `.mjs`로 포팅, byte-parity 검증 완료) |

### `rules/flutter/custom-lint/` (0개)
- [x] ~~`architecture-lint.py`~~ ✅ (architecture-lint.mjs) — hexagonal architecture linter (Dart 소스 import 규칙 검사)

---

## 2. Shell 스크립트 — 플러그인 소유 (1개)

- [ ] `hooks/block-dangerous-commands.sh`
  - ⚠️ `hooks/hooks.json`에서 참조되지 않음 (hooks.json은 command 인라인)
  - **obsolete 여부 먼저 확인 필요** → 삭제 vs `.mjs` 변환 결정

---

## 3. 변환 후 연동 수정 필요

- [x] **`scripts/flutter/gen-scripts.mjs`** ✅ 일반화 완료
  - `renderWrapper(scriptPath)`가 `.mjs`/`.py` 확장자로 dispatch
  - `.mjs` → `node scripts/flutter/<path>.mjs`
  - `.py`  → `poetry run python scripts/flutter/<path>.py`
  - WRAPPERS 항목 `python` → `script`로 리네임
- [ ] **`scripts/flutter/gen-pyproject.mjs`**
  - ⚠️ 당장 제거 불가: downstream Flutter 프로젝트의 pre-commit 훅이 `poetry run pre-commit install`에 의존
  - `template/*.py` 12개도 아직 남아있음 → 이전 완료 후에도 pyproject 유지 여부 재판단
- [ ] **`example/hello_flutter/scripts/*.sh`** (6개)
  - `flutter-build-deploy.sh`, `update-dependencies.sh`, `update-leaf-kit-ref.sh`, `android-show-info-keystore.sh`, `android-signing-report.sh`, `android-signing-verify-apk.sh`
  - `gen-scripts.mjs` 출력물 → 재생성 시 자동 갱신
- [ ] **`commands/*.md`** 일괄 스윕
  - `.py` 경로 언급
  - `poetry run` 명령어
  - `scripts/flutter/<path>.py` → `<path>.mjs`

---

## 4. 제외 (변환 대상 아님)

- `example/hello_flutter/ios/Flutter/**/*.sh` — Flutter 자동 생성
- `example/hello_flutter/ios/Flutter/ephemeral/flutter_lldb_helper.py` — Flutter 자동 생성
- `example/hello_flutter/macos/Flutter/ephemeral/flutter_export_environment.sh` — Flutter 자동 생성
- `rules/flutter/custom-lint/architecture_lint/**` — Dart 패키지 (`.dart_tool/` 등)

---

## 작업 우선순위

1. **shell 정리**: `block-dangerous-commands.sh` 사용 여부 확인 → 제거 or 변환
2. ~~**독립 Python 템플릿**: `template/*.py` 12개~~ ✅ 완료 (`.mjs`로 포팅 + SKILL.md 4종 참조 갱신)
3. **의존성 있는 Python**: `keystore/`, `setup/`, `create/`, `build/`, `dependencies/`, `architecture_lint/`
4. ~~**openapi 패키지**~~ ✅ 완료 (5-phase 분할: update_pubspec → dart_name_utils → openapi_parser → generate_api + 9 .j2 (nunjucks) → _run + __init__ + .py 정리)
5. ~~**`rules/flutter/custom-lint/architecture-lint.py`**~~ ✅ 완료
6. **연동 수정**: `gen-scripts.mjs` 수정 → example 재생성 → `commands/*.md` 스윕 → `gen-pyproject.mjs` 정리

---

## 변환 규칙 (이전 작업 기준)

- `#!/usr/bin/env node` shebang + `0o755` 실행 권한
- ESM(`.mjs`), `node:` prefix imports (`node:fs`, `node:path`, `node:process`, `node:child_process`, `node:url`)
- **보안**: `execSync`/`exec` 금지 → `execFileSync` / `spawnSync`의 argv 배열 형태만 사용 (shell 미경유)
- 스크립트 상대 경로: `fileURLToPath(import.meta.url)` + `path.dirname(...)`
- JSON 파일 편집: `JSON.stringify(data, null, 2) + '\n'` (trailing newline 유지)
- HELP 문자열, `parseArgs()`, `usage(code)` 컨벤션은 `scripts/typescript/gen-husky.mjs` 참조
