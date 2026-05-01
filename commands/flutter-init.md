---
description: Initialize JKit in Flutter project
---

# JKit Flutter Init

Flutter 프로젝트에 JKit 설정을 초기화합니다. 생성 스크립트로 동작합니다.

## 플러그인 경로 확인

스크립트를 실행하기 전에 jkit 플러그인 설치 경로를 확인합니다:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

이후 모든 스크립트 경로는 `$JKIT_DIR`를 기준 디렉토리로 사용합니다.

## 프로젝트 루트 고정

**중요**: 모든 스텝을 실행하기 **전**에 프로젝트 루트를 캡처하고, 스크립트를 실행하는 모든 스텝 시작 시점에 해당 디렉토리로 `cd` 합니다. cwd drift (예: 앞선 스텝에서 `cd app/` 후 원복 안 된 상태)는 잘못된 디렉토리 버그의 가장 흔한 원인입니다 (예: `app/AGENTS.md` 덮어쓰기, husky 훅에 잘못된 config 경로가 베이킹되는 문제 등).

```bash
PROJECT_ROOT="$(pwd)"   # 의도한 프로젝트 루트에서 실행
```

아래 모든 shell 블록은 `cd "$PROJECT_ROOT"`가 해당 스텝에서 이미 실행된 상태를 전제로 합니다.

## 단계

### 1. 프로젝트 이름 확인

사용자에게 프로젝트 이름을 묻습니다. 기본값: 현재 디렉토리 이름.

### 2. 컨벤션 스택 선택

아래 **컨벤션** 스택을 보여주고 사용자에게 선택을 받습니다 (쉼표 구분, 전부 선택은 `all`, 비우면 base만 적용).

> 선택 가능한 컨벤션 스택: `freezed`, `go-router`, `leaf-kit`, `easy-localization`

### 3. Flutter 엔트리 디렉토리 확인

사용자에게 Flutter 엔트리 디렉토리를 묻습니다. 기본값: `app`.

### 4. AGENTS.md 생성 여부

사용자에게 `AGENTS.md` 및 `CLAUDE.md` 심볼릭 링크 생성 여부를 묻습니다.
이 파일들은 사용자가 커스터마이즈할 수 있으므로 선택 스텝입니다.

Yes 선택 시:
```bash
cd "$PROJECT_ROOT"
$JKIT_DIR/scripts/gen-agents.mjs flutter -p . -n "<project-name>" --docs-dir docs
```

### 5. 패키지 매니저 감지 및 package.json 보장

`gen-husky.mjs`는 사용자 프로젝트의 `package.json`에 husky/@commitlint devDependency를 주입하므로 파일이 반드시 존재해야 합니다. Flutter 프로젝트는 전통적으로 `package.json`이 없지만, husky 훅을 활성화하려면 루트에 생성해야 합니다.

#### 5-1. 감지

아래 우선순위로 패키지 매니저(`PM`)를 감지합니다.

```bash
cd "$PROJECT_ROOT"

detect_pm() {
  # 1. 기존 lock 파일 우선
  [ -f pnpm-lock.yaml ]    && echo "pnpm" && return
  [ -f yarn.lock ]         && echo "yarn" && return
  [ -f bun.lockb ]         && echo "bun"  && return
  [ -f package-lock.json ] && echo "npm"  && return
  # 2. package.json의 packageManager 필드
  if [ -f package.json ]; then
    pm_field=$(jq -r '.packageManager // empty' package.json | cut -d@ -f1)
    [ -n "$pm_field" ] && echo "$pm_field" && return
  fi
  # 3. 설치된 매니저 우선순위 (pnpm > yarn > bun > npm)
  command -v pnpm >/dev/null && echo "pnpm" && return
  command -v yarn >/dev/null && echo "yarn" && return
  command -v bun  >/dev/null && echo "bun"  && return
  echo "npm"
}

PM=$(detect_pm)
```

사용자에게 감지 결과를 보여주고 확인을 받습니다: **"감지된 매니저: {PM}. 사용할까요? 다른 매니저를 원하면 npm / yarn / pnpm / bun 중 선택."**

사용자가 다른 매니저를 지정하면 `PM`을 그 값으로 덮어씁니다.

#### 5-2. package.json 보장

```bash
cd "$PROJECT_ROOT"
if [ ! -f package.json ]; then
  case "$PM" in
    npm)  npm init -y ;;
    yarn) yarn init -y ;;
    pnpm) pnpm init ;;
    bun)  bun init -y ;;
  esac
fi
```

> `init`은 기본 필드(name/version/main 등)만 채운 최소 `package.json`을 생성합니다. 이후 Step 6의 `gen-husky.mjs`가 `devDependencies`와 `scripts.prepare`를 자동으로 추가합니다.
> 사용자가 생성을 거부하면 Step 6 이후를 중단하고 `package.json`을 수동 생성 후 재실행하라고 안내합니다.

### 6. 생성 스크립트 실행

플러그인의 `scripts/` 디렉토리에서 다음 스크립트들을 실행합니다.

```bash
cd "$PROJECT_ROOT"

# 1. GIT.md
$JKIT_DIR/scripts/gen-git.mjs -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.mjs flutter -p docs

# 3. CONVENTIONS.md
$JKIT_DIR/scripts/gen-conventions.mjs flutter -p docs --with <conventions-stacks>

# 4. LINT.md (base + 선택 stack lint-rules)
$JKIT_DIR/scripts/gen-lint.mjs flutter -p docs --with <conventions-stacks>

# 5. Husky hooks (.husky/pre-commit에 <entry-dir>이 인라인 치환됨, .husky/commit-msg)
#    + package.json에 husky/@commitlint devDeps와 scripts.prepare 주입
$JKIT_DIR/scripts/gen-husky.mjs flutter -p . -entry <entry-dir>

# 6. commitlint.config.mjs (Conventional Commits + 프로젝트 허용 타입 강제)
$JKIT_DIR/scripts/gen-commitlint.mjs -p .

# 7. 유틸리티 스크립트
$JKIT_DIR/scripts/flutter/gen-scripts.mjs -p . -entry <entry-dir>
```

해당 생성기에 사용자가 선택한 스택이 없으면 `--with` 인자를 생략합니다.

### 7. devDependencies 설치 (husky 활성화)

`gen-husky.mjs`가 `package.json`에 주입한 husky / @commitlint devDeps를 실제로 설치합니다. 설치가 끝날 때 `scripts.prepare` → `husky`가 자동 실행되어 git 훅이 활성화됩니다.

```bash
cd "$PROJECT_ROOT"
case "$PM" in
  npm)  npm install ;;
  yarn) yarn ;;
  pnpm) pnpm install ;;
  bun)  bun install ;;
esac
```

### 8. architecture_lint 주입 (+ stack lint 패키지)

Flutter 엔트리 프로젝트의 `analysis_options.yaml`의 top-level `plugins:` 섹션에 `architecture_lint`(base, git dep)와 사용자가 선택한 컨벤션 스택에 매칭되는 stack lint 패키지(예: `leaf-kit` 선택 시 `leaf_kit_lint`)를 git dep으로 등록합니다. analysis_server_plugin(Dart 3.10+)이 두 패키지를 독립 isolate로 로드해 IDE 및 `dart analyze`에서 동작합니다. 레거시 `custom_lint` dev dep와 `analyzer.plugins:` 항목은 자동으로 제거됩니다. 이 스텝은 **무조건** 실행되어야 합니다.

```bash
cd "$PROJECT_ROOT"
$JKIT_DIR/scripts/flutter/gen-custom-lint.mjs flutter -p . -entry <entry-dir> --stacks <conventions-stacks>
```

사용자가 선택한 스택이 없으면 `--stacks` 인자를 생략합니다. base의 `architecture_lint`만 주입됩니다.

주입 후, 새 의존성을 해결하기 위해 엔트리 디렉토리에서 `dart pub get`을 실행합니다:

```bash
cd "$PROJECT_ROOT/<entry-dir>" && dart pub get && cd "$PROJECT_ROOT"
```

> `gen-custom-lint.mjs`는 idempotent — 동일 git ref면 skip합니다. git ref는 플러그인의 `plugin.json` version에서 자동 결정됩니다. stack ↔ 패키지 매핑은 `inject-custom-lint.mjs`의 `STACK_PACKAGES`에 정의 (현재 `leaf-kit` → `leaf_kit_lint`, `freezed` → `freezed_lint`).

### 9. 보고

사용자에게 생성된 항목을 보고합니다:
- `AGENTS.md` — AI 에이전트 엔트리 포인트
- `CLAUDE.md` → `AGENTS.md` 심볼릭 링크
- `AGENTS.LOCAL.md` — 사용자 소유 프로젝트 고유 가이드 (최초 1회만 생성, 이후 보존)
- `GIT.md` — Git & GitHub 가이드
- `ARCHITECTURE.md` — 아키텍처 상세
- `CONVENTIONS.md` — 선택한 스택이 반영된 컨벤션 (하단에 `CONVENTIONS.LOCAL.md` 링크 포함)
- `CONVENTIONS.LOCAL.md` — 사용자 소유 프로젝트 고유 컨벤션 (최초 1회만 생성, 이후 보존)
- `package.json` — `devDependencies`(`husky`, `@commitlint/cli`, `@commitlint/config-conventional`) + `scripts.prepare: "husky"`
- `.husky/pre-commit` — husky pre-commit 훅 (dart format, flutter analyze; analyzer가 architecture_lint 진단을 자동 통합; 엔트리 디렉토리가 파일에 베이킹됨)
- `.husky/commit-msg` — husky commit-msg 훅 (`commitlint --edit $1`)
- `commitlint.config.mjs` — Conventional Commits 설정 (허용 타입: feat, fix, refactor, docs, test, chore, perf, ci)
- `scripts/flutter-build-deploy.sh` — Flutter 빌드 래퍼
- `scripts/update-dependencies.sh` — 의존성 업데이트 래퍼
- `scripts/update-leaf-kit-ref.sh` — Leaf kit ref 업데이트 래퍼
- `scripts/android-show-info-keystore.sh` — 키스토어 정보 래퍼
- `scripts/android-signing-report.sh` — 서명 리포트 래퍼
- `scripts/android-signing-verify-apk.sh` — APK 검증 래퍼
- `architecture_lint` (base) — `analysis_options.yaml`의 top-level `plugins:` 섹션에 git dep으로 주입. analysis_server_plugin이 IDE/`dart analyze`에 진단 통합
- stack lint 패키지(선택한 스택 기반) — `leaf-kit` 선택 시 `leaf_kit_lint`도 동일하게 `plugins:`에 등록
