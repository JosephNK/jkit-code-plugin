# jkit-code-plugin

Claude Code plugin for project scaffolding and ESLint config generation.

## Conventions Generator

Stack-based conventions.md generator. Base conventions + stack별 conventions를 concat하여 프로젝트별 conventions.md를 생성합니다.

### Usage

```bash
./scripts/gen-conventions.sh <framework> -p <output-dir> [--with stack1,stack2,...]
```

### Next.js

```bash
# Base only
./scripts/gen-conventions.sh nextjs -p /path/to/project

# With stacks
./scripts/gen-conventions.sh nextjs -p /path/to/project \
  --with mantine,tanstack-query,next-proxy
```

**Available stacks:**

| Stack | Description |
|-------|-------------|
| `mantine` | Mantine UI/Styling rules, DESIGN.md mapping, navigation patterns |
| `tanstack-query` | TanStack Query hook layer error handling patterns |
| `next-proxy` | Next.js 16 middleware → proxy breaking changes |

### How it works

1. `base/conventions.md` — 프레임워크 공통 conventions (architecture, layer rules, error handling 등)
2. `<stack>/conventions.md` — 스택별 추가 conventions
3. `gen-conventions.sh` — base + 선택된 stacks를 순서대로 concat하여 최종 conventions.md 생성

생성된 파일은 프로젝트에서 직접 수정하여 관리합니다 (one-time generation).

---

## ESLint Config Generator

Stack-based ESLint config generator. Template + manifest 조합으로 프레임워크별 eslint.config.mjs를 생성합니다.

### Usage

```bash
./scripts/gen-eslint.sh <framework> -p <output-dir> [--with stack1,stack2,...]
```

### Next.js

```bash
# Base only
./scripts/gen-eslint.sh nextjs -p /path/to/project

# With stacks
./scripts/gen-eslint.sh nextjs -p /path/to/project \
  --with mantine,mongodb,nextauth,email-template,tanstack-query,next-proxy,theme
```

**Available stacks:**

| Stack | Description |
|-------|-------------|
| `mantine` | Mantine UI restricted patterns, syntax, domain ban |
| `mongodb` | MongoDB boundary elements/rules, domain ban |
| `nextauth` | NextAuth boundary elements/rules, domain ban |
| `email-template` | Email template boundary elements/rules |
| `tanstack-query` | TanStack Query domain ban |
| `next-proxy` | `src/proxy.ts` boundary ignore |
| `theme` | `src/theme.ts` boundary ignore |

### NestJS

```bash
# Base only
./scripts/gen-eslint.sh nestjs -p /path/to/project

# With stacks
./scripts/gen-eslint.sh nestjs -p /path/to/project \
  --with typeorm,gcp,anthropic-ai,local-rules
```

**Available stacks:**

| Stack | Description |
|-------|-------------|
| `typeorm` | TypeORM framework ban (model/port layers) |
| `gcp` | Google Cloud SDK ban (model/port/service/exception layers) |
| `anthropic-ai` | Anthropic AI SDK ban (model/port/service/exception layers) |
| `local-rules` | Custom ESLint plugin rules (require-api-property, dto-union-type-restriction, dto-naming-convention, require-timestamptz, require-map-domain-exception) |

### How it works

1. `base/eslint.template.mjs` -- `// {{MARKER}}` placeholder가 포함된 템플릿
2. `<stack>/eslint.manifest` -- `--- section ---` 구분자로 각 marker에 삽입할 코드 조각 정의
3. `<stack>/eslint.rules.mjs` -- 스택별 ESLint rule export 모듈
4. `gen-eslint.sh` -- 템플릿의 marker를 manifest 내용으로 치환하여 최종 config 생성

생성된 파일은 프로젝트에서 직접 수정하여 관리합니다 (one-time generation).

### Adding a new stack

1. `rules/<framework>/<stack-name>/` 디렉토리 생성
2. `eslint.rules.mjs` 작성 (export할 rule data가 있는 경우)
3. `eslint.manifest` 작성 (각 section에 삽입할 코드 조각)

**Manifest sections:**

Next.js: `import`, `restricted`, `domain`, `syntax`, `elements`, `rules`, `patches`, `ignores`

NestJS: `import`, `framework`, `infra`, `elements`, `rules`, `ignores`, `custom`
