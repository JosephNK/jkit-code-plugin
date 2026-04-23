---
description: Initialize JKit in Next.js project
---

# JKit Next.js Init

Initialize JKit configuration for a Next.js project using generator scripts.

## Resolve plugin path

Before running any script, resolve the jkit plugin install path:

```bash
JKIT_DIR=$(jq -r '.plugins["jkit@jkit"][0].installPath' ~/.claude/plugins/installed_plugins.json)
```

All script paths below use `$JKIT_DIR` as the base directory.

## Pin project root

**IMPORTANT**: Capture the project root **before** running any step, and `cd` into it at the start of every step that executes scripts. cwd drift is the most common cause of wrong-directory bugs (e.g., generating `AGENTS.md` inside a subdir).

```bash
PROJECT_ROOT="$(pwd)"   # run this from the intended project root
```

Every shell block below assumes `cd "$PROJECT_ROOT"` has already been executed in that step.

## Steps

### 1. Ask project name

Ask the user for the project name. Default: current directory name.

### 2. Ask conventions stacks

Show the **conventions** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).

> Available conventions stacks: `mantine`, `antd`, `tanstack-query`, `next-proxy`
>
> Note: `mantine` and `antd` are mutually exclusive in practice — enable the UI library stack your project actually uses.

### 3. Ask ESLint stacks

Show the **ESLint** stacks below and ask the user to select (comma-separated, `all` for all stacks, or empty for base only).
**IMPORTANT: ESLint stacks are NOT the same as conventions stacks. You MUST show ALL items from the list below — do NOT omit any.**

1. `mantine`
2. `antd`
3. `nextauth`
4. `tanstack-query`
5. `next-proxy`

> Note: `mantine` and `antd` are mutually exclusive in practice — pick the UI library stack your project actually uses.

### 4. Ask tsconfig stacks

> Available tsconfig stacks: (none — base only, skip selection)

### 5. Ask AGENTS.md generation

Ask the user whether to generate `AGENTS.md` and `CLAUDE.md` symlink.
This step is optional because the user may need to customize these files.

If yes:
```bash
cd "$PROJECT_ROOT"
$JKIT_DIR/scripts/gen-agents.mjs nextjs -p . -n "<project-name>" --docs-dir docs
```

### 6. Ensure `src/app` layout

jkit의 Next.js 컨벤션·ESLint·문서는 모두 **`src/app/`** 를 정본 위치로 가정합니다 (예: `src/app/**/_components`, `src/app/**/_providers` 등). 프로젝트가 루트에 `app/`만 가진 경우 규칙이 매칭되지 않으므로 구조를 일치시킵니다.

```bash
cd "$PROJECT_ROOT"

if [ -d app ] && [ ! -d src/app ]; then
  # 사용자에게 확인: "app/ 루트 디렉토리를 src/app/으로 이동할까요?" (default: yes)
  # - yes: 아래 이동 실행
  # - no:  경고 출력 후 중단 ("jkit 컨벤션은 src/app/을 가정합니다. 수동으로 이동 후 재실행하거나 이 init을 취소하세요")
  mkdir -p src
  git mv app src/app 2>/dev/null || mv app src/app
  echo "Moved: app/ → src/app/"
fi
```

**체크리스트 (이동 후 사용자가 수동 확인 필요한 항목)**
- `tsconfig.json`의 `paths` 매핑에 `"@/*": ["./src/*"]` (또는 동등) 유지 확인
- `next.config.js`/`next.config.mjs`의 `experimental.appDir` 같은 커스텀 설정 없음 확인 (Next.js 15+ 기본값으로 `src/app` 지원)
- `import` 경로가 상대 경로(`../`)로 되어 있다면 이동 후 깨질 수 있음 — 주로 alias(`@/...`)만 썼으면 영향 없음
- Git 이력: `git mv`로 이동되어 파일 이력 보존됨

> `src/app/`와 `app/`이 둘 다 있거나 `src/app/`만 있으면 이 스텝은 건너뜁니다.

### 7. Detect package manager & ensure package.json

`gen-eslint.mjs`는 사용자 프로젝트의 `package.json`에 devDependency를 주입하므로 파일이 반드시 존재해야 합니다. 또한 이후 Step 8의 install 명령을 프로젝트가 이미 쓰는 패키지 매니저에 맞춰야 합니다.

#### 6-1. Detect

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

#### 6-2. Ensure package.json

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

### 8. Run generator scripts

Run the following scripts from the plugin's `scripts/` directory.

```bash
cd "$PROJECT_ROOT"

# 1. GIT.md
$JKIT_DIR/scripts/gen-git.mjs -p docs

# 2. ARCHITECTURE.md
$JKIT_DIR/scripts/gen-architecture.mjs nextjs -p docs

# 3. CONVENTIONS.md — 사용자 선택 스택만 사용 (base에는 stylelint 섹션 없음)
USER_CONV_STACKS="<conventions-stacks>"   # Step 2의 사용자 선택값
if [ -n "$USER_CONV_STACKS" ]; then
  $JKIT_DIR/scripts/gen-conventions.mjs nextjs -p docs --with "$USER_CONV_STACKS"
else
  $JKIT_DIR/scripts/gen-conventions.mjs nextjs -p docs
fi

# 4. ESLint config (Step 6에서 package.json 존재를 보장한 뒤 실행)
$JKIT_DIR/scripts/typescript/gen-eslint.mjs nextjs -p . --with <eslint-stacks>

# 5. Stylelint config (항상 실행, 스택 선택 없음)
#    - stylelint.config.mjs 생성
#    - package.json: devDeps + scripts.lint:css + lint-staged 자동 주입
$JKIT_DIR/scripts/typescript/gen-stylelint.mjs nextjs -p .

# 6. tsconfig.json patch
$JKIT_DIR/scripts/typescript/gen-tsconfig.mjs nextjs -p .

# 7. Husky hooks
$JKIT_DIR/scripts/typescript/gen-husky.mjs nextjs -p .
```

Skip `--with` if the user selected no stacks for that generator.

### 9. Install ESLint rules dependency

`gen-eslint.mjs`는 생성된 `eslint.config.mjs`에서 `@jkit/eslint-rules`를 import하도록 작성하고, 사용자 프로젝트의 `package.json` `devDependencies`에 git 의존성을 추가합니다:

```json
"@jkit/eslint-rules": "github:JosephNK/jkit-code-plugin#v<current-version>"
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

> 설치 후 `node_modules/@jkit/eslint-rules/`에 `rules/nextjs/` 디렉토리가 배치됩니다 (플러그인 repo의 `files` 필드로 nextjs 규칙만 포함).

### 10. Report

Tell the user what was created:
- `AGENTS.md` — AI agent entry point
- `CLAUDE.md` → `AGENTS.md` symlink
- `GIT.md` — Git & GitHub guide
- `ARCHITECTURE.md` — Architecture details
- `CONVENTIONS.md` — Conventions with selected stacks
- `eslint.config.mjs` — ESLint config with selected stacks (imports `@jkit/eslint-rules/nextjs/*`)
- `stylelint.config.mjs` — Stylelint config (extends `stylelint-config-standard` + jkit baseline rules)
- `package.json` — devDependencies(`@jkit/eslint-rules`, `stylelint`, `stylelint-config-standard`, `stylelint-declaration-strict-value`) + `scripts.lint:css` + `lint-staged` CSS glob
- `tsconfig.json` — Patched with framework-specific settings
- `.husky/` — Git hooks (pre-commit, commit-msg)
