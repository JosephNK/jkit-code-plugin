---
description: Sync JKit docs and lint config in Flutter project
---

# JKit Flutter Sync

Flutter 프로젝트의 JKit docs(`GIT.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `LINT.md`)와 `architecture_lint` pin을 플러그인 최신 버전과 동기화합니다.

> 이 커맨드는 init이 아닙니다. `AGENTS.md`, `AGENTS.LOCAL.md`, `CONVENTIONS.LOCAL.md`, `package.json`, `.husky/`, `commitlint.config.mjs`, `scripts/` 유틸은 건드리지 않습니다. 최초 셋업은 `/jkit-flutter-init`를 사용하세요.

## 플러그인 경로 확인

스크립트를 실행하기 전에 jkit 플러그인 설치 경로를 확인합니다:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

이후 모든 스크립트 경로는 `$JKIT_DIR`를 기준 디렉토리로 사용합니다.

## 프로젝트 루트 고정

```bash
PROJECT_ROOT="$(pwd)"   # 의도한 프로젝트 루트에서 실행
```

아래 모든 shell 블록은 `cd "$PROJECT_ROOT"`가 해당 스텝에서 이미 실행된 상태를 전제로 합니다.

## 단계

### 1. 컨벤션 스택 선택

아래 **컨벤션** 스택을 보여주고 사용자에게 선택을 받습니다 (쉼표 구분, 전부 선택은 `all`, 비우면 base만 적용).

> 선택 가능한 컨벤션 스택: `freezed`, `go-router`, `leaf-kit`, `easy-localization`

### 2. Flutter 엔트리 디렉토리 확인

사용자에게 Flutter 엔트리 디렉토리를 묻습니다. 기본값: `app`. (`pubspec.yaml`이 위치한 디렉토리)

### 3. Docs 재생성

```bash
cd "$PROJECT_ROOT"

# 1. GIT.md
$JKIT_DIR/scripts/gen-git.mjs -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.mjs flutter -p docs

# 3. CONVENTIONS.md (LOCAL은 절대 건드리지 않음 — 없어도 새로 만들지 않음)
$JKIT_DIR/scripts/gen-conventions.mjs flutter -p docs --with <conventions-stacks> --no-local-init

# 4. LINT.md
$JKIT_DIR/scripts/gen-lint.mjs flutter -p docs
```

해당 생성기에 사용자가 선택한 스택이 없으면 `--with` 인자를 생략합니다.

### 4. architecture_lint pin 갱신 (+ stack lint 패키지)

엔트리 프로젝트의 `pubspec.yaml`에 박힌 `architecture_lint` git ref를 플러그인의 현재 버전(`plugin.json`)에 맞추고, 사용자가 선택한 컨벤션 스택에 매칭되는 stack lint 패키지(예: `leaf-kit` 선택 시 `leaf_kit_lint`)도 동일 ref로 갱신·추가합니다.

```bash
cd "$PROJECT_ROOT"
$JKIT_DIR/scripts/flutter/gen-architecture-lint.mjs flutter -p . -entry <entry-dir> --stacks <conventions-stacks>
```

사용자가 선택한 스택이 없으면 `--stacks` 인자를 생략합니다. base의 `architecture_lint`만 sync됩니다.

> idempotent — 동일 git ref면 skip합니다. additive only — 이전에 설치된 stack 패키지는 자동 제거되지 않으므로, 스택을 빼고 싶으면 `pubspec.yaml`에서 수동 삭제하세요.

ref가 바뀌어 pubspec이 갱신된 경우, 엔트리 디렉토리에서 `dart pub get`을 실행합니다:

```bash
cd "$PROJECT_ROOT/<entry-dir>" && dart pub get && cd "$PROJECT_ROOT"
```

### 5. 보고

사용자에게 갱신된 항목을 보고합니다:

- `docs/GIT.md` — Git & GitHub 가이드 (덮어쓰기)
- `docs/ARCHITECTURE.md` — 아키텍처 상세 (덮어쓰기)
- `docs/CONVENTIONS.md` — 선택한 스택이 반영된 컨벤션 (덮어쓰기, 하단 `CONVENTIONS.LOCAL.md` 링크 포함)
- `docs/LINT.md` — Lint 규칙 참조 (덮어쓰기)
- `pubspec.yaml` — `architecture_lint` (base) + 선택한 stack lint 패키지(예: `leaf_kit_lint`) git ref (변경/추가 시에만 갱신)

> 보존된 사용자 소유 파일: `AGENTS.md`, `AGENTS.LOCAL.md`, `CONVENTIONS.LOCAL.md`, `package.json`, `.husky/`, `commitlint.config.mjs`, `scripts/`.
