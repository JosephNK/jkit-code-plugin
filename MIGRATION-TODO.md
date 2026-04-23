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

- [ ] `hooks/block-dangerous-commands.sh` — **보류**
  - `hooks/hooks.json`에서 참조되지 않음 (hooks.json은 command 인라인)
  - 이 파일에만 있는 rm -rf 차단 룰은 현재 hooks.json에 이식되지 않음
  - 처리 방침 후속 결정

---

## 3. 변환 후 연동 수정 필요

- [x] **`scripts/flutter/gen-scripts.mjs`** ✅ 일반화 완료
  - `renderWrapper(scriptPath)`가 `.mjs`/`.py` 확장자로 dispatch
  - `.mjs` → `node scripts/flutter/<path>.mjs`
  - `.py`  → `poetry run python scripts/flutter/<path>.py`
  - WRAPPERS 항목 `python` → `script`로 리네임
- [x] **`scripts/flutter/gen-pyproject.mjs`** ✅ 삭제 (husky 이전으로 Poetry 의존 완전 제거)
- [x] **`example/hello_flutter/scripts/*.sh`** (6개) ✅ 모두 `.mjs`를 가리키도록 갱신됨 (`gen-scripts.mjs`로 재생성)
- [x] **`commands/*.md`** 스윕 ✅ 완료
  - 플러그인 `.py` 경로 언급 없음
  - `flutter-init.md` Step 7에서 `poetry run pre-commit install` 제거 (husky 전환에 따라)
  - `code-harness.md`의 Python 항목은 범용 빌드 체크리스트 (의도된 참조)

---

## 4. 제외 (변환 대상 아님)

- `example/hello_flutter/ios/Flutter/**/*.sh` — Flutter 자동 생성
- `example/hello_flutter/ios/Flutter/ephemeral/flutter_lldb_helper.py` — Flutter 자동 생성
- `example/hello_flutter/macos/Flutter/ephemeral/flutter_export_environment.sh` — Flutter 자동 생성
- `rules/flutter/custom-lint/architecture_lint/**` — Dart 패키지 (`.dart_tool/` 등)

---

## 작업 우선순위

1. **shell 정리**: `block-dangerous-commands.sh` — **보류** (후속 결정)
2. ~~**독립 Python 템플릿**: `template/*.py` 12개~~ ✅ 완료 (`.mjs`로 포팅 + SKILL.md 4종 참조 갱신)
3. ~~**의존성 있는 Python**: `keystore/`, `setup/`, `create/`, `build/`, `dependencies/`, `architecture_lint/`~~ ✅ 완료
4. ~~**openapi 패키지**~~ ✅ 완료 (5-phase 분할: update_pubspec → dart_name_utils → openapi_parser → generate_api + 9 .j2 (nunjucks) → _run + __init__ + .py 정리)
5. ~~**`rules/flutter/custom-lint/architecture-lint.py`**~~ ✅ 완료
6. ~~**연동 수정**: `gen-scripts.mjs` → example 재생성 → `commands/*.md` 스윕 → `gen-pyproject.mjs` 정리~~ ✅ 완료

**플러그인 `.py` 파일 포팅 전체 완료** (잔여: `block-dangerous-commands.sh` 처리 방침 결정만 남음).

---

## 5. husky 이전 (pre-commit 프레임워크 → husky)

2026-04-23 착수. 기존 `gen-precommit.mjs`가 생성하던 `.pre-commit-config.yaml`의 4개 로컬 훅을 husky `.husky/pre-commit` 인라인 bash로 이식. pre-commit 공통 훅(trailing-whitespace/EOF/check-yaml)은 드롭. lint-staged/자체 bin 래퍼는 도입하지 않음(룰이 모두 프로젝트 전체 대상이라 불필요).

### 완료

- [x] **`scripts/typescript/gen-husky.mjs` → `scripts/gen-husky.mjs` 이동** (flutter·nestjs·nextjs 공용이므로 typescript 하위가 아닌 공용 위치로). `-entry <dir>` 옵션 추가 → `{{ENTRY}}` 치환
- [x] **`rules/flutter/base/husky/pre-commit`** 4개 bash 룰 이식 (`{{ENTRY}}` placeholder)
- [x] **`rules/flutter/base/husky/commit-msg`** (사용자 seed 유지, `commitlint --edit $1`). commitlint 설정은 nestjs/nextjs 패턴과 일관되게 downstream 책임으로 둠 (플러그인이 `commitlint.config.mjs` 템플릿을 제공하지 않음).
- [x] **삭제**: `scripts/flutter/gen-precommit.mjs`
- [x] **참조 갱신**: `commands/flutter-init.md` (Step 4 husky hooks + Step 7 `poetry run pre-commit install` 제거 + Step 9 Report 갱신), `commands/nestjs-init.md`, `commands/nextjs-init.md`, `README.md`

### 매핑 결과

| 기존 pre-commit 훅 | 이식 방식 |
|---|---|
| `trailing-whitespace` / `end-of-file-fixer` / `check-yaml` | **드롭** (필요 시 추후 prettier 등으로 복원 가능) |
| `dart-format` | `echo "$staged_dart" \| xargs dart format --set-exit-if-changed` (husky 인라인) |
| `flutter-analyze` | `(cd {{ENTRY}} && flutter analyze --fatal-infos)` (husky 인라인) |
| `architecture-lint` | `(cd {{ENTRY}} && dart run architecture_lint:lint "$(pwd)")` (IDE plugin과 동일 Dart 패키지) |
| `flutter-test` (related) | 기존 bash one-liner 그대로 husky 인라인 |
| `conventional-pre-commit` (commit-msg) | `npx --no -- commitlint --edit $1` (commitlint 설정은 downstream 책임) |

- [x] **`commands/update-pre-commit-config-ref.md` 삭제** — 호출하던 `gen-precommit.mjs`가 사라진 데다, nestjs/nextjs에 동등 command 없음(일관성 부재), husky는 install 단계가 없어 재생성은 `scripts/gen-husky.mjs` 한 줄이면 충분. `README.md`의 `/jkit:flutter-update-precommit` 엔트리도 함께 제거.

### 후속 검토 필요 (이번 세션 범위 밖)

- [x] ~~**`pyproject.toml` / `poetry.lock` / `gen-pyproject.mjs` 제거 가능성**~~ ✅ 완료 — 플러그인 루트 `pyproject.toml` / `poetry.lock` 삭제, `gen-pyproject.mjs` 삭제, `flutter-init.md`에서 Step 4(pyproject 옵션)·Step 7(`poetry install`) 제거 및 단계 번호 재조정, `README.md`에서 `gen-pyproject.mjs` 엔트리 제거, `gen-scripts.mjs` `.py` 브랜치 제거.
- [ ] **downstream 설치 체인 설계** — Flutter 프로젝트에 `package.json` + husky/@commitlint devDeps 추가 방법. `example/hello_flutter` 검증은 사용자 지시로 이번 범위 밖.

---

## 변환 규칙 (이전 작업 기준)

- `#!/usr/bin/env node` shebang + `0o755` 실행 권한
- ESM(`.mjs`), `node:` prefix imports (`node:fs`, `node:path`, `node:process`, `node:child_process`, `node:url`)
- **보안**: `execSync`/`exec` 금지 → `execFileSync` / `spawnSync`의 argv 배열 형태만 사용 (shell 미경유)
- 스크립트 상대 경로: `fileURLToPath(import.meta.url)` + `path.dirname(...)`
- JSON 파일 편집: `JSON.stringify(data, null, 2) + '\n'` (trailing newline 유지)
- HELP 문자열, `parseArgs()`, `usage(code)` 컨벤션은 `scripts/gen-husky.mjs` 참조
