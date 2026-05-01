# Architecture

> 이 문서: 헥사고날 **원리 · Data Flow · Dependency Direction** 개념 해설.

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

> 이 문서는 개념/흐름에 집중하고, 실제 레이어별 세부는 단일 소스에서 관리한다.
