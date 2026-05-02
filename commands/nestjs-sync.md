---
description: Sync JKit docs and lint config in NestJS project
---

# JKit NestJS Sync

NestJS 프로젝트의 JKit docs(`GIT.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `LINT.md`)와 `eslint.config.mjs`를 플러그인 최신 버전과 동기화합니다.

> 이 커맨드는 init이 아닙니다. `AGENTS.md`, `AGENTS.PROJECT.md`, `CONVENTIONS.PROJECT.md`, `tsconfig.json`, `.husky/`, `commitlint.config.mjs`는 건드리지 않습니다. 최초 셋업은 `/jkit-nestjs-init`를 사용하세요.

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

> 선택 가능한 컨벤션 스택: `typeorm`

### 2. ESLint 스택 선택

아래 **ESLint** 스택을 보여주고 사용자에게 선택을 받습니다 (쉼표 구분, 전부 선택은 `all`, 비우면 base만 적용).
**중요: ESLint 스택은 컨벤션 스택과 동일하지 않습니다. 아래 목록의 모든 항목을 빠짐없이 보여줘야 합니다 — 임의로 생략하지 마세요.**

1. `typeorm`
2. `gcp`
3. `anthropic-ai`

### 3. 패키지 매니저 감지

Step 5의 install 명령을 프로젝트가 이미 쓰는 패키지 매니저에 맞추기 위해 감지합니다.

```bash
cd "$PROJECT_ROOT"

detect_pm() {
  [ -f pnpm-lock.yaml ]    && echo "pnpm" && return
  [ -f yarn.lock ]         && echo "yarn" && return
  [ -f bun.lockb ]         && echo "bun"  && return
  [ -f package-lock.json ] && echo "npm"  && return
  if [ -f package.json ]; then
    pm_field=$(jq -r '.packageManager // empty' package.json | cut -d@ -f1)
    [ -n "$pm_field" ] && echo "$pm_field" && return
  fi
  command -v pnpm >/dev/null && echo "pnpm" && return
  command -v yarn >/dev/null && echo "yarn" && return
  command -v bun  >/dev/null && echo "bun"  && return
  echo "npm"
}

PM=$(detect_pm)
```

사용자에게 감지 결과를 보여주고 확인을 받습니다: **"감지된 매니저: {PM}. 사용할까요? 다른 매니저를 원하면 npm / yarn / pnpm / bun 중 선택."**

### 4. Docs / Lint 재생성

```bash
cd "$PROJECT_ROOT"

# 1. GIT.md
$JKIT_DIR/scripts/gen-git.mjs -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.mjs nestjs -p docs

# 3. STRUCTURE.md (lint-rules-structure-reference 복사)
$JKIT_DIR/scripts/gen-structure.mjs nestjs -p docs

# 4. CONVENTIONS.md (PROJECT는 절대 건드리지 않음 — 없어도 새로 만들지 않음)
$JKIT_DIR/scripts/gen-conventions.mjs nestjs -p docs --with <conventions-stacks> --no-project-init

# 5. LINT.md (base + 선택 stack lint-rules)
$JKIT_DIR/scripts/gen-lint.mjs nestjs -p docs --with <eslint-stacks>

# 6. ESLint config (package.json의 @jkit/code-plugin git ref도 갱신됨)
$JKIT_DIR/scripts/typescript/gen-eslint.mjs nestjs -p . --with <eslint-stacks>
```

해당 생성기에 사용자가 선택한 스택이 없으면 `--with` 인자를 생략합니다.

### 5. 의존성 재설치

`@jkit/code-plugin` git ref가 새 버전으로 갱신되었으므로 install로 동기화합니다.

```bash
cd "$PROJECT_ROOT"
case "$PM" in
  npm)  npm install ;;
  yarn) yarn ;;
  pnpm) pnpm install ;;
  bun)  bun install ;;
esac
```

### 6. 보고

사용자에게 갱신된 항목을 보고합니다:

- `docs/GIT.md` — Git & GitHub 가이드 (덮어쓰기)
- `docs/ARCHITECTURE.md` — 아키텍처 상세 (덮어쓰기)
- `docs/STRUCTURE.md` — lint 룰이 가정하는 디렉토리 구조 참조 (덮어쓰기)
- `docs/CONVENTIONS.md` — 선택한 스택이 반영된 컨벤션 (덮어쓰기, 하단 `CONVENTIONS.PROJECT.md` 링크 포함)
- `docs/LINT.md` — Lint 규칙 참조 (덮어쓰기)
- `eslint.config.mjs` — 선택한 스택이 반영된 ESLint 설정 (덮어쓰기)
- `package.json` — `@jkit/code-plugin` git ref만 현재 플러그인 버전으로 갱신 (그 외 필드는 보존)

> 보존된 사용자 소유 파일: `AGENTS.md`, `AGENTS.PROJECT.md`, `CONVENTIONS.PROJECT.md`, `tsconfig.json`, `.husky/`, `commitlint.config.mjs`.
