# Architecture

> 이 문서: 헥사고날 **원리 · Data Flow · Dependency Direction** 개념 해설.
> 레이어별 책임·포함·네이밍·대표 코드 형태: `@jkit/eslint-rules/nextjs/base/lint-rules-reference.md` ("레이어 글로서리")
> 레이어 경로 매핑 (App Router 트리): `@jkit/eslint-rules/nextjs/base/lint-rules-structure-reference.md`
> 레이어 의존성 규칙 (allow 매트릭스 / 무시 경로): `@jkit/eslint-rules/nextjs/base/lint-rules-reference.md`
> 레이어 의존성 그래프 (Mermaid 시각화): `@jkit/eslint-rules/nextjs/base/lint-rules-diagram.md`

Hexagonal Architecture (Ports and Adapters) + Next.js App Router colocated components.
Domain logic is pure TypeScript with no framework dependencies.
Pages are Server Components (data loading, i18n). Client Components are colocated in `_components/` directories.

## Layer Diagram

```
[page]             app/[locale]/        Server Component (data fetching, i18n)
    |
[_components]      _components/         Client Component ('use client', event handling)
    |
[hook]             lib/api/hooks/       TanStack Query (useQuery/useMutation)
    |
[service]          lib/domain/services/ Business logic (pure TS, depends only on Ports)
    |
[port]             lib/domain/ports/    Interface (Repository contracts)
    |
[repository]       lib/api/repositories/ Port implementation (API calls via client)
    |
Backend API
```

## Data Flow

### Request (call direction)

```
_components/*       Event triggered (button click, etc.)
    |
Hook                TanStack Query (useQuery/useMutation)
    |
Service             Composes business logic (pure TS, depends only on Ports)
    |
Port                Calls Repository through interface
    |
Repository Impl     Calls API via client
    |
Backend API
```

### Response (return direction)

```
Backend API
    |  HTTP Response (JSON)
API DTO             Raw backend response shape
    |
Repository Impl     Applies Mapper internally
    |  Mapper       DTO to Domain conversion
    |
Domain Model        Pure TS entity (readonly immutable object)
    |
Service             Applies business logic, returns Domain Model
    |
Hook                Stores in cache + updates state
    |
_components/*       Handles loading/error branching (Client Component)
    |
Page                Passes data to layout (Server Component)
    |
RENDERED UI
```

### Dependency Direction

```
Page (SC) -> _components/ (CC) -> Hook -> Service -> Port (interface) <- Repository Impl -> Client + Mapper
                  |                                                       |
             Domain Model  <-  <-  <-  <-  <-  <-  <-  <-  <-  <-  <-  <-
                         (all layers depend on this)
```

## Layer Details

> 각 레이어의 역할·포함 파일 종류·네이밍 관례·대표 코드 형태는
> `@jkit/eslint-rules/nextjs/base/lint-rules-reference.md`의 **"레이어 글로서리 (Layer Glossary)"** 섹션을 참고.
> 이 문서는 개념/흐름에 집중하고, 실제 레이어별 세부는 단일 소스에서 관리한다.
