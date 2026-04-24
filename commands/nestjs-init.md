---
description: Initialize JKit in NestJS project
---

# JKit NestJS Init

NestJS 프로젝트에 JKit 설정을 초기화합니다. 생성 스크립트로 동작합니다.

## 플러그인 경로 확인

스크립트를 실행하기 전에 jkit 플러그인 설치 경로를 확인합니다:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

이후 모든 스크립트 경로는 `$JKIT_DIR`를 기준 디렉토리로 사용합니다.

## 프로젝트 루트 고정

**중요**: 모든 스텝을 실행하기 **전**에 프로젝트 루트를 캡처하고, 스크립트를 실행하는 모든 스텝 시작 시점에 해당 디렉토리로 `cd` 합니다. cwd drift는 잘못된 디렉토리 버그의 가장 흔한 원인입니다 (예: 서브디렉토리 안에서 `AGENTS.md`가 생성되는 문제 등).

```bash
PROJECT_ROOT="$(pwd)"   # 의도한 프로젝트 루트에서 실행
```

아래 모든 shell 블록은 `cd "$PROJECT_ROOT"`가 해당 스텝에서 이미 실행된 상태를 전제로 합니다.

## 단계

### 1. 프로젝트 이름 확인

사용자에게 프로젝트 이름을 묻습니다. 기본값: 현재 디렉토리 이름.

### 2. 컨벤션 스택 선택

아래 **컨벤션** 스택을 보여주고 사용자에게 선택을 받습니다 (쉼표 구분, 전부 선택은 `all`, 비우면 base만 적용).

> 선택 가능한 컨벤션 스택: `typeorm`

### 3. ESLint 스택 선택

아래 **ESLint** 스택을 보여주고 사용자에게 선택을 받습니다 (쉼표 구분, 전부 선택은 `all`, 비우면 base만 적용).
**중요: ESLint 스택은 컨벤션 스택과 동일하지 않습니다. 아래 목록의 모든 항목을 빠짐없이 보여줘야 합니다 — 임의로 생략하지 마세요.**

1. `typeorm`
2. `gcp`
3. `anthropic-ai`

### 4. tsconfig 스택 선택

아래 **tsconfig** 스택을 보여주고 사용자에게 선택을 받습니다 (쉼표 구분, 전부 선택은 `all`, 비우면 base만 적용).

> 선택 가능한 tsconfig 스택: `typeorm`

### 5. AGENTS.md 생성 여부

사용자에게 `AGENTS.md` 및 `CLAUDE.md` 심볼릭 링크 생성 여부를 묻습니다.
이 파일들은 사용자가 커스터마이즈할 수 있으므로 선택 스텝입니다.

Yes 선택 시:
```bash
cd "$PROJECT_ROOT"
$JKIT_DIR/scripts/gen-agents.mjs nestjs -p . -n "<project-name>" --docs-dir docs
```

### 6. 패키지 매니저 감지 및 package.json 보장

`gen-eslint.mjs`는 사용자 프로젝트의 `package.json`에 devDependency를 주입하므로 파일이 반드시 존재해야 합니다. 또한 이후 Step 8의 install 명령을 프로젝트가 이미 쓰는 패키지 매니저에 맞춰야 합니다.

#### 6-1. 감지

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

#### 6-2. package.json 보장

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

> `init`은 기본 필드(name/version/main 등)만 채운 최소 `package.json`을 생성합니다. 이후 스텝에서 `devDependencies`가 자동으로 추가됩니다.
> 사용자가 생성을 거부하면 Step 7 이후를 중단하고 `package.json`을 수동 생성 후 재실행하라고 안내합니다.

### 7. 생성 스크립트 실행

플러그인의 `scripts/` 디렉토리에서 다음 스크립트들을 실행합니다.

```bash
cd "$PROJECT_ROOT"

# 1. GIT.md
$JKIT_DIR/scripts/gen-git.mjs -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.mjs nestjs -p docs

# 3. CONVENTIONS.md
$JKIT_DIR/scripts/gen-conventions.mjs nestjs -p docs --with <conventions-stacks>

# 4. ESLint config (Step 6에서 package.json 존재를 보장한 뒤 실행)
$JKIT_DIR/scripts/typescript/gen-eslint.mjs nestjs -p . --with <eslint-stacks>

# 5. tsconfig.json patch
$JKIT_DIR/scripts/typescript/gen-tsconfig.mjs nestjs -p . --with <tsconfig-stacks>

# 6. Husky hooks
#    + package.json에 husky/lint-staged/@commitlint devDeps와 scripts.prepare 주입
$JKIT_DIR/scripts/gen-husky.mjs nestjs -p .

# 7. commitlint.config.mjs (Conventional Commits + 프로젝트 허용 타입 강제)
$JKIT_DIR/scripts/gen-commitlint.mjs -p .
```

해당 생성기에 사용자가 선택한 스택이 없으면 `--with` 인자를 생략합니다.

### 8. ESLint rules 의존성 설치

`gen-eslint.mjs`는 생성된 `eslint.config.mjs`에서 `@jkit/code-plugin`를 import하도록 작성하고, 사용자 프로젝트의 `package.json` `devDependencies`에 git 의존성을 추가합니다:

```json
"@jkit/code-plugin": "github:JosephNK/jkit-code-plugin#v<current-version>"
```

의존성을 실제로 설치합니다. 명령은 Step 6에서 결정된 `PM` 변수에 따라 분기합니다.

```bash
cd "$PROJECT_ROOT"
case "$PM" in
  npm)  npm install ;;
  yarn) yarn ;;
  pnpm) pnpm install ;;
  bun)  bun install ;;
esac
```

> 설치 후 `node_modules/@jkit/code-plugin/`에 `rules/nestjs/` 디렉토리가 배치됩니다 (플러그인 repo의 `files` 필드로 nestjs 규칙만 포함).

> **peerDependencies**: `@jkit/code-plugin`는 `eslint-plugin-import`를 peer로 요구합니다 (순환 의존성 감지용). 프로젝트에 없으면 Step 6에서 결정된 `PM`에 맞춰 추가 설치합니다. 대부분의 패키지 매니저는 peerDep 누락 시 경고 또는 자동 설치로 대응합니다.
>
> ```bash
> cd "$PROJECT_ROOT"
> case "$PM" in
>   npm)  npm install -D eslint-plugin-import ;;
>   yarn) yarn add -D eslint-plugin-import ;;
>   pnpm) pnpm add -D eslint-plugin-import ;;
>   bun)  bun add -d eslint-plugin-import ;;
> esac
> ```

### 9. 보고

사용자에게 생성된 항목을 보고합니다:
- `AGENTS.md` — AI 에이전트 엔트리 포인트
- `CLAUDE.md` → `AGENTS.md` 심볼릭 링크
- `GIT.md` — Git & GitHub 가이드
- `ARCHITECTURE.md` — 아키텍처 상세
- `CONVENTIONS.md` — 선택한 스택이 반영된 컨벤션
- `eslint.config.mjs` — 선택한 스택이 반영된 ESLint 설정 (`@jkit/code-plugin/nestjs/*` import)
- `package.json` — `devDependencies`에 `@jkit/code-plugin`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional` 추가 + `scripts.prepare: "husky"`
- `tsconfig.json` — 프레임워크별 설정으로 패치됨
- `.husky/pre-commit` — `npx lint-staged` + `npx jkit-check-i18n`
- `.husky/commit-msg` — `npx --no -- commitlint --edit $1`
- `commitlint.config.mjs` — Conventional Commits 설정 (허용 타입: feat, fix, refactor, docs, test, chore, perf, ci)
