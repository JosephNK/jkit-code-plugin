---
name: nextjs-openapi-gen
description: Generates TypeScript DTO types and endpoint helpers from an OpenAPI 3.x spec into src/http/_generated/. Use for requests like "Generate API types", "Create types from spec", "Set up API from swagger".
argument-hint: "<spec> [--dry-run]"
---

<!--
OpenAPI 3.x specification files for code generation.
/jkit:nextjs-openapi-gen specs/openapi.yaml
-->

# Next.js OpenAPI Code Generator Skill

Generates `src/http/_generated/types.ts` (DTO interfaces) and `src/http/_generated/endpoints.ts` (URL helpers) from an OpenAPI 3.x spec.

**Generated files are fully overwritten on every run.** `src/http/client.ts` 그리고 feature-first 디렉토리 `src/http/<feature>/{mapper,repository,hook}.ts`는 user-authored — generator는 절대 손대지 않는다 (변환 규칙·Port 설계·캐시 정책 등 spec에서 도출 불가한 비즈니스 결정 영역).

## Arguments

- `spec` (required): OpenAPI spec file path or URL
- `--dry-run` (optional): Preview only — no files written

## Workflow

1. **Parse arguments**: Extract spec path/URL, dry-run from `$ARGUMENTS`.
2. **Check/install npm dependencies** (plugin script requires `yaml`):
   ```bash
   (cd ${CLAUDE_PLUGIN_ROOT} && [ -d node_modules/yaml ] || npm install)
   ```
   `${CLAUDE_PLUGIN_ROOT}`가 fresh checkout이면 `node_modules`가 없어 후속 node 실행이 실패한다 — 누락 시 자동 설치한다.
3. **Generate API code**:
   ```bash
   cd ${CLAUDE_PLUGIN_ROOT} && node scripts/nextjs/openapi/generate-api.mjs {spec} [--dry-run]
   ```
   - URL spec은 `specs/openapi.{yaml,json}`으로 프로젝트 루트에 저장된다 (VCS 추적용).
   - 출력은 항상 프로젝트의 `src/http/_generated/types.ts` + `src/http/_generated/endpoints.ts`.
4. **Format generated files** (skip if --dry-run):
   ```bash
   npx prettier --write src/http/_generated/types.ts src/http/_generated/endpoints.ts
   ```
5. **Report**: schema·operation 개수와 생성 파일 경로 출력.

## Generated File Structure

```
src/http/
├── _generated/                    # ← generator 전용 (수기 편집 금지)
│   ├── types.ts                   # ← GENERATED — DTO interfaces
│   └── endpoints.ts               # ← GENERATED — URL helpers
├── client.ts                      # user-authored — HTTP client config
├── <feature>/                     # user-authored — feature-first
│   ├── mapper.ts                  #   DTO ↔ Domain conversion
│   ├── repository.ts              #   Port implementation
│   └── hook.ts                    #   TanStack Query hooks
└── ...
```

### `src/http/_generated/types.ts` 예시

```ts
// GENERATED CODE - DO NOT MODIFY BY HAND

export type UserStatusDto = 'active' | 'inactive' | 'banned';

export interface UserDto {
  id: string;
  email: string;
  status: UserStatusDto;
  createdAt: string;
}

export interface OrderItemDto {
  productId: string;
  quantity: number;
}

export interface OrderDto {
  id: string;
  userId: string;
  items: OrderItemDto[];
}
```

### `src/http/_generated/endpoints.ts` 예시

```ts
// GENERATED CODE - DO NOT MODIFY BY HAND

export const endpoints = {
  getUser: (id: string) => `/users/${id}`,
  listUsers: () => `/users`,
  createUser: () => `/users`,
  updateOrder: (orderId: string) => `/orders/${orderId}`,
} as const;
```

## Mapping Rules

| OpenAPI | TypeScript |
|---|---|
| `components.schemas.<Name>` | `export interface <Name>Dto` |
| `type: string, enum: [...]` | `export type <Name>Dto = 'A' \| 'B' \| 'C'` |
| `type: integer` / `type: number` | `number` |
| `type: boolean` | `boolean` |
| `type: string` (any format) | `string` (런타임 변환은 mapper 책임) |
| `type: array, items: ...` | `<Item>[]` |
| `type: object` w/ `properties` | nested interface (top-level만 `Dto` suffix) |
| `additionalProperties: T` | `Record<string, T>` |
| `nullable: true` | `... \| null` |
| `oneOf` / `anyOf` | union (`A \| B`) |
| `allOf` | intersection (`A & B`) |
| `$ref: '#/components/schemas/Foo'` | `FooDto` |
| `required: [...]` 외 필드 | `?:` optional |
| operation w/ `operationId` | `endpoints.<operationId>(...)` |
| operation w/o `operationId` | `endpoints.<method><PathPascal>(...)` fallback |
| `parameters[in=path]` | 함수 인자 (타입은 schema 기반, 기본 `string`) |

## Limitations

- **Single spec only** — 재실행 시 두 파일 풀 덮어쓰기. 멀티 spec이 필요해지면 컨벤션부터 재논의 필요.
- **`components/schemas`만 DTO 추출** — `paths` 내 inline schema(`$ref` 아닌)는 제외. 모든 응답/요청 타입은 `components/schemas`에 정의해야 한다.
- **이미 `Dto`로 끝나는 schema명은 중복 suffix 안 붙임** (`UserDto` → `UserDto` 유지).
- **`oneOf` + `discriminator`**: 단순 union만 생성. 타입 narrowing 헬퍼는 mapper 레이어에서 작성.
- **client.ts·mappers·repositories·hooks·domain은 생성 안 함** — 자세한 이유는 SKILL.md 상단 참조.

## Usage Examples

```
/jkit:nextjs-openapi-gen specs/openapi.yaml

/jkit:nextjs-openapi-gen https://api.example.com/openapi.json

/jkit:nextjs-openapi-gen specs/openapi.yaml --dry-run
```

## Notes

- Generated files have `// GENERATED CODE - DO NOT MODIFY BY HAND` header.
- 동일 spec으로 재실행하면 deterministic하게 같은 출력 (idempotent).
- URL spec은 `specs/openapi.{yaml,json}`로 저장돼 VCS 추적 가능. boundary 검사는 `specs/`를 자동 무시.
- 본 스킬은 `/jkit:nextjs-init`로 셋업된 `src/http/` 레이아웃을 가정한다.
