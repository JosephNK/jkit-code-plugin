# Conventions

## General Rules

- Path alias: `@/*` → `src/`
- Functional components + TypeScript

## Layer Rules

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

## Page + Colocated Components Pattern

Page는 dictionary 로딩과 서버 데이터 fetch를 맡고, `_components/`의 Client Component에 props로 전달. Hook 사용은 Client Component에서만. `'use client'` 경계는 leaf-level까지 미룬다.

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
- Type safety: `Dictionary` type is derived from `en.json` via `typeof import`

```tsx
// Page (SC) loads dictionary, passes translated strings to Client Component
const dict = await getDictionary(locale);
return <ProductsContent dict={dict.Products} />;
```
