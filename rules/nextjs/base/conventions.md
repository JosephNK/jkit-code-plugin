# Conventions

> 레이어 경로 매핑: `@jkit/eslint-rules/nextjs/base/lint-rules-structure-reference.md`
> 레이어 의존성 규칙 (allow 매트릭스 / 무시 경로): `@jkit/eslint-rules/nextjs/base/lint-rules-reference.md`

## General Rules

- Path alias: `@/*` → `src/`
- Functional components + TypeScript

## Layer Rules

- Domain Port defines Repository contract interfaces
- Domain Model sits at the bottom of the dependency graph, keeping business logic framework-independent
- When switching REST → GraphQL, only Repository implementations need to change
- For simple CRUD, Service may pass through to Port directly (avoid unnecessary wrapping)
- **API DTO must come from Swagger/OpenAPI codegen** — do not hand-write DTO types

## Component Reuse

- **UI patterns repeated 2+ times MUST be extracted into a shared component** (`src/components/ui/`)
- If the same JSX + props combination appears in 2 or more places, extract immediately
- Replace all existing usages with the shared component

## Code Duplication

- **Code duplication MUST stay below 5%** (enforced by `jscpd` with `.jscpd.json` threshold)
- Run `npm run lint:cpd` to check duplication rate
- **Shared infrastructure MUST be extracted into a named file and imported, not re-implemented** — when two sites need the same helper (error wrapper, DTO serializer, guard, etc.), extract it to a single module under the appropriate layer (`api-mapper`, `api-repository`, or a project-level type) rather than copy-pasting.

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

## Page + Colocated Components Pattern

### Page (Server Component)

- Role: Dictionary loading, server-side data fetching, passes data to Client Components
- `async/await` allowed, no Hooks

### Client Component (`_components/`)

- Role: Interactivity, Hooks, loading/error state, rendering
- Must declare `'use client'`
- Push `'use client'` boundary as deep (leaf-level) as possible

### Shared UI (`components/ui/`)

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

- Components are Server Components by default in App Router (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`)
- Files using Hooks (useState, TanStack Query, etc.) must declare `'use client'` — typically `_components/`, `_providers/`, `src/lib/api/hooks/`
- Push `'use client'` boundary as deep (leaf-level) as possible
- `src/lib/domain/`, `src/lib/api/types.ts`, `src/lib/api/mappers/` can be used in both server and client (pure TS)

## Error Handling Strategy

### Service Layer

- Throws domain errors on business rule violations (e.g., `InsufficientStockError`)
- Domain errors are pure TS classes defined in `src/lib/domain/errors/`

### Repository Layer

- Converts HTTP/database errors to domain errors (e.g., 404 → `NotFoundError`, duplicate key → `DuplicateError`)
- Propagates network errors upward for retry mechanism

### API Route Layer (Route Handler)

- Catch domain errors and return appropriate HTTP status codes
- Map domain error instances to `{ code, message, statusCode }` response shape
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
