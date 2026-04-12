# Conventions

## General Rules

- Path alias: `@/*` → `src/`
- Functional components + TypeScript

## Component Reuse

- **UI patterns repeated 2+ times MUST be extracted into a shared component** (`src/components/ui/`)
- If the same JSX + props combination appears in 2 or more places, extract immediately
- Replace all existing usages with the shared component

## Code Duplication

- **Code duplication MUST stay below 5%** (enforced by `jscpd` with `.jscpd.json` threshold)
- Run `npm run lint:cpd` to check duplication rate
- **Shared infrastructure MUST be imported, not re-implemented:**
  - Client service helpers (`ApiCallError`, `callApi`, `FetchFn`, DTO mappers) → `src/lib/domain/services/client-helpers.ts`
  - API response DTO serializers (`toProjectDto`, `toBuildDto`) → `src/lib/api/response.ts`
  - Auth guard dev bypass → `getDevBypassUser()` in `src/lib/api/guards.ts`
- When adding a new client service, import from `client-helpers.ts` instead of copying boilerplate

## Navigation

- **Internal links MUST use `next/link`** (`Link` component) — NOT `component="a"` + `href`
- Mantine components (`Button`, `Card`, etc.) that link to internal pages: use `component={Link}` (from `next/link`)
- `component="a"` is only allowed for **external URLs** (e.g., `https://...`)
- Reason: `component="a"` causes full page reload, breaking client-side navigation and causing unnecessary loading on browser back/forward

```tsx
// WRONG — causes full page reload
<Button component="a" href={`/${locale}/admin/users`}>Manage</Button>
<Card component="a" href={`/${locale}/projects/${id}`}>...</Card>

// CORRECT — client-side navigation
import Link from 'next/link';
<Button component={Link} href={`/${locale}/admin/users`}>Manage</Button>
<Card component={Link} href={`/${locale}/projects/${id}`}>...</Card>
```

## Layer Rules

- Domain Port (`src/lib/domain/ports/`) defines Repository contract interfaces
- Domain Model sits at the bottom of the dependency graph, keeping business logic framework-independent
- When switching REST → GraphQL, only Repository implementations need to change
- For simple CRUD, Service may pass through to Port directly (avoid unnecessary wrapping)

| Layer          | Path                        | Allowed Imports                                                     | Forbidden Imports           |
| -------------- | --------------------------- | ------------------------------------------------------------------- | --------------------------- |
| Domain Model   | `src/lib/domain/models/`    | Pure TS only                                                        | All external packages       |
| Domain Error   | `src/lib/domain/errors/`    | Pure TS only                                                        | All external packages       |
| Domain Port    | `src/lib/domain/ports/`     | domain/models (Pure TS only)                                        | All external packages       |
| API DTO        | `src/lib/api/types.ts`      | Swagger/OpenAPI generated only                                      | Manual type definitions     |
| Service        | `src/lib/domain/services/`  | domain/models, domain/ports, domain/errors                          | api/\*                      |
| Mapper         | `src/lib/api/mappers/`      | domain/models, api/types                                            | —                           |
| Repository     | `src/lib/api/repositories/` | api/client, api/endpoints, api/mappers, domain/ports, domain/errors | —                           |
| API Helper     | `src/lib/api/*.ts`          | domain/\*, api/repositories, api/helpers, email-templates, auth     | page, hooks                 |
| Email Template | `src/lib/email-templates/`  | dictionaries, shared-types                                          | domain/\*, api/\*           |
| Hook           | `src/lib/api/hooks/`        | domain/services                                                     | api/types, api/repositories |
| Shared UI      | `src/components/`           | domain/models                                                       | Hooks, api/\*               |
| \_components   | `src/app/**/_components/`   | Hooks, shared UI, domain/models                                     | api/\*, dictionary access   |
| \_providers    | `src/app/**/_providers/`    | lib-shared only                                                     | api/\*, domain/\*           |
| Page           | `src/app/[locale]/`         | \_components, \_providers, shared UI, dictionaries                  | Hooks, direct api/\* calls  |

## Page + Colocated Components Pattern

### Page (Server Component)

- Location: `src/app/[locale]/**/page.tsx`
- Role: Dictionary loading, server-side data fetching, passes data to Client Components
- `async/await` allowed, no Hooks

### Client Component (`_components/`)

- Location: `src/app/[locale]/**/_components/`
- Role: Interactivity, Hooks, loading/error state, rendering
- Must declare `'use client'`
- Push `'use client'` boundary as deep (leaf-level) as possible

### Shared UI (`components/ui/`)

- Location: `src/components/ui/`
- Role: Shared primitives (icons, common UI elements) used across pages

```tsx
// Page (SC): src/app/[locale]/products/page.tsx
export default async function ProductsPage({ params }: PageProps<'/[locale]/products'>) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return <ProductsContent dict={dict.Products} />;
}

// Client Component: src/app/[locale]/products/_components/ProductsContent.tsx
('use client');

export function ProductsContent({ dict }: { dict: Dictionary['Products'] }) {
  const { data, isLoading, error, refetch } = useProducts();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorFallback message={error.message} onRetry={refetch} />;

  return (
    <Stack gap="md">
      <Title order={2}>{dict.title}</Title>
      <Stack gap="xs">
        {data.map((p) => (
          <Text key={p.id}>{p.name}</Text>
        ))}
      </Stack>
    </Stack>
  );
}
```

## Server Component / Client Component Boundary

```
Server Component (default)             Client Component ('use client')
─────────────────────────              ────────────────────────────────
src/app/[locale]/**/page.tsx           src/app/[locale]/**/_components/*.tsx
src/app/[locale]/layout.tsx            src/app/[locale]/**/_providers/*.tsx
src/app/[locale]/loading.tsx           src/lib/api/hooks/*.ts
src/app/[locale]/error.tsx
```

- Components are Server Components by default in App Router
- Files using Hooks (useState, TanStack Query, etc.) must declare `'use client'`
- Push `'use client'` boundary as deep (leaf-level) as possible
- `src/lib/domain/`, `src/lib/api/types.ts`, `src/lib/api/mappers/` can be used in both server and client (pure TS)

## Error Handling Strategy

### Service Layer

- Throws domain errors on business rule violations (e.g., `InsufficientStockError`)
- Domain errors are pure TS classes defined in `src/lib/domain/errors/`

### Repository Layer

- Converts HTTP/database errors to domain errors (e.g., 404 → `NotFoundError`, duplicate key → `DuplicateError`)
- Propagates network errors upward for retry mechanism

### API Route Layer

- Uses `handleApiError()` from `src/lib/api/response.ts` to catch domain errors and return appropriate HTTP status codes
- `AppError` instances are mapped to `{ code, message, statusCode }`
- Unknown errors produce a generic 500 response without exposing internal details

### Client Component Layer (`_components/`)

- Branches on `isLoading`, `error` state returned from Hooks

### Page Layer

- `error.tsx` (Next.js Error Boundary) catches unexpected errors

## Internationalization (next-intl)

- `en.json` is the source of truth for dictionary keys — `ko.json` must match its structure (located in `src/common/dictionaries/`)
- Dictionary keys are organized by feature/page (e.g., `Products`, `Navigation`)
- Client Components receive translated strings as props (no dictionary access inside `_components/`)
- Dictionary loading happens in Server Components only (`server-only` enforced)
- Type safety: `Dictionary` type is derived from `en.json` via `typeof import`

```tsx
// Page (SC) loads dictionary, passes translated strings to Client Component
const dict = await getDictionary(locale);
return <ProductsContent dict={dict.Products} />;
```

## Documentation Reference

- Always check latest docs via Context7 MCP before writing/reviewing Next.js / React / Mantine code
- Prefer Context7 docs over training data (training cutoff)
