---
description: Sync JKit docs and lint config in Next.js project
---

# JKit Next.js Sync

Next.js 프로젝트의 JKit docs(`GIT.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `LINT.md`), lint config(`eslint.config.mjs`, `stylelint.config.mjs`), `.husky/` 훅을 플러그인 최신 버전과 동기화합니다.

> 이 커맨드는 init이 아닙니다. `AGENTS.md`, `AGENTS.PROJECT.md`, `CONVENTIONS.PROJECT.md`, `tsconfig.json`, `commitlint.config.mjs`는 건드리지 않습니다. (`package.json`의 husky/@commitlint/lint-staged devDeps와 `scripts.prepare`, `.husky/` 훅은 sync 대상.) 최초 셋업은 `/jkit-nextjs-init`를 사용하세요.

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
**중요: 이전 대화·세션 컨텍스트와 무관하게, 매 실행마다 아래 5개 항목을 모두 그대로 노출해야 합니다. 항목을 임의로 생략하거나 이전 응답에서 사용한 축약 목록을 재사용하지 마세요.**

1. `design-system/mantine`
2. `design-system/antd`
3. `design-system/shadcn`
4. `tanstack-query`
5. `next-proxy`

> 참고: `design-system/*` 스택(`mantine`, `antd`, `shadcn`)은 실무상 상호 배타적입니다 — 프로젝트가 실제로 쓰는 UI 라이브러리 스택 하나만 활성화하세요.

### 2. ESLint 스택 선택

아래 **ESLint** 스택을 보여주고 사용자에게 선택을 받습니다 (쉼표 구분, 전부 선택은 `all`, 비우면 base만 적용).
**중요: ESLint 스택은 컨벤션 스택과 동일하지 않습니다. 이전 대화·세션 컨텍스트와 무관하게, 매 실행마다 아래 6개 항목을 모두 그대로 노출해야 합니다 — 항목을 임의로 생략하거나 이전 응답에서 사용한 축약 목록을 재사용하지 마세요.**

1. `design-system/mantine`
2. `design-system/antd`
3. `design-system/shadcn`
4. `nextauth`
5. `tanstack-query`
6. `next-proxy`

> 참고: `design-system/*` 스택(`mantine`, `antd`, `shadcn`)은 실무상 상호 배타적입니다 — 프로젝트가 실제로 쓰는 UI 라이브러리 스택 하나만 선택하세요.

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
$JKIT_DIR/scripts/gen-architecture.mjs nextjs -p docs

# 3. STRUCTURE.md (lint-rules-structure-reference 복사)
$JKIT_DIR/scripts/gen-structure.mjs nextjs -p docs

# 4. CONVENTIONS.md (PROJECT는 절대 건드리지 않음 — 없어도 새로 만들지 않음)
USER_CONV_STACKS="<conventions-stacks>"   # Step 1의 사용자 선택값
if [ -n "$USER_CONV_STACKS" ]; then
  $JKIT_DIR/scripts/gen-conventions.mjs nextjs -p docs --with "$USER_CONV_STACKS" --no-project-init
else
  $JKIT_DIR/scripts/gen-conventions.mjs nextjs -p docs --no-project-init
fi

# 5. LINT.md (lint-rules + structure-reference + stylelint-rules + 선택 stack lint-rules)
$JKIT_DIR/scripts/gen-lint.mjs nextjs -p docs --with <eslint-stacks>

# 6. ESLint config (package.json의 @jkit/code-plugin git ref도 갱신됨)
$JKIT_DIR/scripts/typescript/gen-eslint.mjs nextjs -p . --with <eslint-stacks>

# 7. Stylelint config (항상 실행, 스택 선택 없음)
$JKIT_DIR/scripts/typescript/gen-stylelint.mjs nextjs -p .

# 8. Husky hooks (.husky/* 덮어쓰기 + package.json husky/@commitlint/lint-staged devDeps와 scripts.prepare 패치)
$JKIT_DIR/scripts/gen-husky.mjs nextjs -p .
```

해당 생성기에 사용자가 선택한 스택이 없으면 `--with` 인자를 생략합니다.

> husky 훅 sync는 `.husky/` 파일과 `package.json` devDeps/`scripts.prepare`를 모두 덮어씁니다. 사용자 수정 훅은 보존되지 않으므로 프로젝트별 커스터마이즈는 jkit 체크아웃의 `rules/nextjs/base/husky/` 템플릿을 fork해야 합니다.

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

#### peer 누락 보강

기존 프로젝트가 구버전 `@jkit/code-plugin`로 설치되어 신규 peer가 누락된 경우 보강합니다. 이미 있으면 매니저가 skip합니다.

`typescript-eslint`는 `eslint-config-next@16+`가 transitive로 가져오므로 top-level에 명시하지 않는다. 명시 설치 시 `@typescript-eslint` 플러그인이 두 인스턴스로 등록되어 flat config가 거부한다. `gen-eslint.mjs`가 user `package.json`에 항목이 남아 있으면 자동으로 제거한다.

```bash
cd "$PROJECT_ROOT"

NEXTJS_PEERS="eslint-plugin-boundaries eslint-plugin-import eslint-import-resolver-typescript eslint-plugin-simple-import-sort eslint-plugin-unused-imports eslint-plugin-sonarjs eslint-config-prettier eslint-config-next"

case "$PM" in
  npm)  npm install -D $NEXTJS_PEERS ;;
  yarn) yarn add -D $NEXTJS_PEERS ;;
  pnpm) pnpm add -D $NEXTJS_PEERS ;;
  bun)  bun add -d $NEXTJS_PEERS ;;
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
- `stylelint.config.mjs` — Stylelint 설정 (덮어쓰기)
- `.husky/pre-commit`, `.husky/commit-msg` — husky 훅 (덮어쓰기)
- `package.json` — `@jkit/code-plugin` git ref + `devDependencies`(`husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`) + `scripts.prepare` 갱신 (그 외 필드는 보존)

> 보존된 사용자 소유 파일: `AGENTS.md`, `AGENTS.PROJECT.md`, `CONVENTIONS.PROJECT.md`, `tsconfig.json`, `commitlint.config.mjs`.
