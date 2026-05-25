---
name: nextjs-openapi-gen
description: Generates TypeScript DTO types, endpoint helpers, and tag-grouped API service classes from an OpenAPI 3.x spec into src/http/_generated/. Also scaffolds src/http/client.ts on first run. Use for requests like "Generate API types", "Create types from spec", "Set up API from swagger".
argument-hint: "<spec> [--dry-run] [--force-client]"
---

<!--
OpenAPI 3.x specification files for code generation.
/jkit:nextjs-openapi-gen specs/openapi.yaml
-->

# Next.js OpenAPI Code Generator Skill

Generates three artifacts from an OpenAPI 3.x spec:

- `src/http/_generated/types.ts` — DTO interfaces (`components/schemas`)
- `src/http/_generated/endpoints.ts` — URL helpers (operation별 path 템플릿)
- `src/http/_generated/services/<tag-kebab>.ts` — tag별 API 서비스 클래스 (operation 1개 = 메서드 1개, `KyInstance` 주입, 반환은 raw DTO)

추가로 `src/http/client.ts`가 없으면 **최소 스캐폴드**를 한 번 생성한다. services가 `KyInstance` 주입을 요구하므로 client.ts 없이는 컴파일 불가 — 첫 실행 시점에만 셋업해주고, 이후 사용자가 직접 401 refresh · 인증 헤더 · 인터셉터 같은 비즈니스 로직을 채워넣는다.

**Generated files are fully overwritten on every run.** Stale service files for renamed tags are also removed on each run. `src/http/client.ts`는 존재 시 보존(스킵)되며 `--force-client` 명시 시에만 덮어쓴다. Feature-first 디렉토리 `src/http/<feature>/{mapper,repository,hook}.ts`는 user-authored — generator는 절대 손대지 않는다 (변환 규칙·Port 설계·캐시 정책 등 spec에서 도출 불가한 비즈니스 결정 영역).

## Arguments

- `spec` (required): OpenAPI spec file path or URL
- `--dry-run` (optional): Preview only — no files written
- `--force-client` (optional): Overwrite existing `src/http/client.ts` scaffold (기본은 스킵)

## Workflow

1. **Parse arguments**: Extract spec path/URL, dry-run from `$ARGUMENTS`.
2. **Check/install npm dependencies** (plugin script requires `yaml`):
   ```bash
   (cd ${CLAUDE_PLUGIN_ROOT} && [ -d node_modules/yaml ] || npm install)
   ```
   `${CLAUDE_PLUGIN_ROOT}`가 fresh checkout이면 `node_modules`가 없어 후속 node 실행이 실패한다 — 누락 시 자동 설치한다.
3. **Generate API code** (반드시 프로젝트 루트에서 실행, `cd ${CLAUDE_PLUGIN_ROOT}` 금지):
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/nextjs/openapi/generate-api.mjs {spec} [--dry-run] [--force-client]
   ```
   - 스크립트는 `process.cwd()`를 프로젝트 루트로 사용하므로 cwd를 plugin 디렉토리로 옮기면 출력 파일이 plugin cache에 만들어진다.
   - URL spec은 `specs/openapi.{yaml,json}`으로 프로젝트 루트에 저장된다 (VCS 추적용).
   - 출력: `src/http/_generated/{types,endpoints}.ts` + `src/http/_generated/services/*.ts` (항상 덮어쓰기) + `src/http/client.ts` (없을 때만 스캐폴드 생성, 존재 시 보존).
   - Swagger UI URL(`/api-docs`)을 그대로 넘겨도 스크립트가 HTML 응답을 감지해 `/api-docs-json`, `/v3/api-docs` 등 일반 spec 엔드포인트로 자동 fallback 한다.
4. **Format generated files** (skip if --dry-run):
   ```bash
   npx prettier --write 'src/http/_generated/types.ts' 'src/http/_generated/endpoints.ts' 'src/http/_generated/services/*.ts' 'src/http/client.ts'
   ```
   `client.ts`는 스크립트가 새로 만들었거나 `--force-client`로 덮어썼을 때만 변경되어 있다. prettier는 그 외의 경우엔 사용자 코드를 건드리지 않는다 (idempotent).
5. **Report**: schema·operation 개수, tag별 service 파일 경로, client.ts 액션(create/skip/overwrite) 출력.

## Generated File Structure

```
src/http/
├── _generated/                    # ← generator 전용 (수기 편집 금지)
│   ├── types.ts                   # ← GENERATED — DTO interfaces
│   ├── endpoints.ts               # ← GENERATED — URL helpers
│   └── services/                  # ← GENERATED — tag별 API 서비스 클래스
│       ├── <tag-kebab>.ts         #   operation 1개 = 메서드 1개
│       └── ...
├── client.ts                      # 스캐폴드 (없을 때 1회 생성, 이후 user-authored)
├── <feature>/                     # user-authored — feature-first
│   ├── mapper.ts                  #   DTO ↔ Domain conversion
│   ├── repository.ts              #   Port implementation (uses generated service)
│   └── hook.ts                    #   TanStack Query hooks
└── ...
```

### `src/http/client.ts` 스캐폴드 (없을 때 1회 생성)

```ts
import ky, { type KyInstance } from "ky";

const API_PROXY_PATH = "/api/proxy";

function getPrefix(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${API_PROXY_PATH}`;
  }

  const apiUrl = process.env.NEST_API_URL;
  if (!apiUrl) {
    throw new Error("NEST_API_URL is required for server-side API calls");
  }
  return apiUrl;
}

function createApiInstance(): KyInstance {
  return ky.create({
    prefix: getPrefix(),
    retry: {
      limit: 2,
      methods: ["get"],
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
    timeout: 30_000,
    headers: { Accept: "application/json" },
  });
}

let api: KyInstance | null = null;

export function getApi(): KyInstance {
  if (api === null) api = createApiInstance();
  return api;
}

export function resetApiInstance(): void {
  api = null;
}
```

**핵심 패턴**: 브라우저는 `/api/proxy` Next.js route handler를 거치고, 서버(SSR·route handler)만 `NEST_API_URL` env로 백엔드 직통. env가 서버에서만 읽히므로 `NEXT_PUBLIC_` prefix가 필요 없다. 401 자동 refresh · 인증 헤더 · 인터셉터 등은 spec에서 도출 불가한 비즈니스 결정 — 이 스캐폴드를 시작점으로 사용자가 채워넣는다.

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

### `src/http/_generated/services/<tag-kebab>.ts` 예시

```ts
// GENERATED CODE - DO NOT MODIFY BY HAND

import type { KyInstance } from "ky";
import { endpoints } from "../endpoints";
import type { UserDto, CreateUserDto } from "../types";

export class UsersService {
  constructor(private readonly api: KyInstance) {}

  async getUser(id: string): Promise<UserDto> {
    return this.api.get(endpoints.getUser(id)).json<UserDto>();
  }

  async createUser(body: CreateUserDto): Promise<UserDto> {
    return this.api.post(endpoints.createUser(), { json: body }).json<UserDto>();
  }
}
```

Tag → 파일/클래스명 매핑은 kebab-case (파일) / PascalCase + `Service` suffix (클래스). 예: `"User Profile"` → `user-profile.ts` + `UserProfileService`.

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
| operation w/ `operationId` | `endpoints.<operationId>(...)` + 서비스 메서드명 |
| operation w/o `operationId` | `endpoints.<method><PathPascal>(...)` fallback |
| `parameters[in=path]` | 함수 인자 (타입은 schema 기반, 기본 `string`) |
| `parameters[in=query]` | 서비스 메서드 `query?: { ... }` 인자 (모든 query가 required면 non-optional) |
| `requestBody.content['application/json']` | 서비스 메서드 `body: BodyDto` 인자 + `{ json: body }` 전달 |
| `responses['200'\|'201'\|'202'\|'2XX']` content | 서비스 메서드 반환 타입 |
| 응답 schema 없음 / 204 | 메서드 반환 `Promise<void>` (`.json<T>()` 호출 생략) |
| `operation.tags[0]` | 서비스 파일/클래스 그룹핑 키 (없으면 `Default`) |
| query에 array (`string[]`) 포함 | 서비스 클래스 내 `private toSearchParams(q)` helper 자동 emit |

## Limitations

- **Single spec only** — 재실행 시 두 파일 풀 덮어쓰기. 멀티 spec이 필요해지면 컨벤션부터 재논의 필요.
- **`components/schemas`만 DTO 추출** — `paths` 내 inline schema(`$ref` 아닌)는 제외. 모든 응답/요청 타입은 `components/schemas`에 정의해야 한다.
- **이미 `Dto`로 끝나는 schema명은 중복 suffix 안 붙임** (`UserDto` → `UserDto` 유지).
- **`oneOf` + `discriminator`**: 단순 union만 생성. 타입 narrowing 헬퍼는 mapper 레이어에서 작성.
- **mappers·repositories·hooks·domain은 생성 안 함** — 자세한 이유는 SKILL.md 상단 참조. (services는 spec에서 100% 도출 가능해 생성 대상)
- **client.ts는 첫 실행 시점에만 스캐폴드 생성** — 존재하면 보존, `--force-client` 명시 시에만 덮어쓰기. 인증·401 refresh 같은 비즈니스 로직은 spec에서 도출 불가하므로 사용자가 직접 확장.
- **응답 envelope 가정 없음** — 백엔드가 `{ success, data: T }` 같은 wrapper를 쓰더라도 spec의 schema 그대로 반환. unwrap은 repository/mapper 레이어 책임.
- **인증 헤더는 client 인터셉터로 처리** — `parameters[in=header]`는 무시 (서비스 메서드 인자에 등장하지 않음). 인증·트레이싱 헤더는 `src/http/client.ts`의 `beforeRequest` 훅에서 일괄 처리.

## Usage Examples

```
/jkit:nextjs-openapi-gen specs/openapi.yaml

/jkit:nextjs-openapi-gen https://api.example.com/openapi.json

/jkit:nextjs-openapi-gen specs/openapi.yaml --dry-run

# 기존 client.ts를 스캐폴드로 되돌리기 (사용자 변경 손실 주의)
/jkit:nextjs-openapi-gen specs/openapi.yaml --force-client
```

## Notes

- Generated files have `// GENERATED CODE - DO NOT MODIFY BY HAND` header.
- 동일 spec으로 재실행하면 deterministic하게 같은 출력 (idempotent).
- URL spec은 `specs/openapi.{yaml,json}`로 저장돼 VCS 추적 가능. boundary 검사는 `specs/`를 자동 무시.
- 본 스킬은 `/jkit:nextjs-init`로 셋업된 `src/http/` 레이아웃을 가정한다.
