# jkit-code-plugin

Claude Code plugin for project scaffolding, conventions and ESLint config generation.

## Agents Generator

AGENTS.md + CLAUDE.md 심볼릭 링크를 생성합니다.

```bash
./scripts/gen-agents.sh nextjs -p /path/to/project -n "My Project"
./scripts/gen-agents.sh nestjs -p /path/to/project
```

## Git Guide Generator

공통 GIT.md를 생성합니다.

```bash
./scripts/gen-git.sh -p /path/to/project
```

## Conventions Generator

Base conventions + stack별 conventions를 concat하여 conventions.md를 생성합니다.

```bash
# Next.js
./scripts/gen-conventions.sh nextjs -p /path/to/project \
  --with mantine,design-system,tanstack-query,next-proxy

# NestJS
./scripts/gen-conventions.sh nestjs -p /path/to/project \
  --with typeorm
```

## Architecture Generator

Base architecture.md를 복사하여 ARCHITECTURE.md를 생성합니다.

```bash
# Next.js
./scripts/gen-architecture.sh nextjs -p /path/to/project

# NestJS
./scripts/gen-architecture.sh nestjs -p /path/to/project
```

## ESLint Config Generator

Template + manifest 조합으로 eslint.config.mjs를 생성합니다.

```bash
# Next.js
./scripts/gen-eslint.sh nextjs -p /path/to/project \
  --with mantine,mongodb,nextauth,email-template,tanstack-query,next-proxy,theme

# NestJS
./scripts/gen-eslint.sh nestjs -p /path/to/project \
  --with typeorm,gcp,anthropic-ai,local-rules
```

## TSConfig Patcher

기존 tsconfig.json에 프레임워크별 설정을 패치합니다.

```bash
# Next.js
./scripts/gen-tsconfig.sh nextjs -p /path/to/project

# NestJS
./scripts/gen-tsconfig.sh nestjs -p /path/to/project \
  --with typeorm
```

## How it works

### Conventions (`gen-conventions.sh`)

1. `base/conventions.md` — 프레임워크 공통 conventions
2. `<stack>/conventions.md` — 스택별 추가 conventions
3. base + 선택된 stacks를 순서대로 concat하여 최종 conventions.md 생성

### ESLint (`gen-eslint.sh`)

1. `base/eslint.template.mjs` — `// {{MARKER}}` placeholder가 포함된 템플릿
2. `<stack>/eslint.manifest` — `--- section ---` 구분자로 각 marker에 삽입할 코드 조각 정의
3. `<stack>/eslint.rules.mjs` — 스택별 ESLint rule export 모듈
4. 템플릿의 marker를 manifest 내용으로 치환하여 최종 config 생성

생성된 파일은 프로젝트에서 직접 수정하여 관리합니다 (one-time generation).

### Adding a new stack

1. `rules/<framework>/<stack-name>/` 디렉토리 생성
2. ESLint: `eslint.rules.mjs` + `eslint.manifest` 작성
3. Conventions: `conventions.md` 작성
4. TSConfig: `tsconfig.patch.json` 작성 (필요 시)
