## Tanstack

Use TanStack Query for all server state management.

### Error Handling — Hook Layer (TanStack Query)

- `useQuery` with `throwOnError: false` (default) — Hook returns `error` object
- Global error handling via `QueryClient`'s `onError` callback (toast, logging)
- Mutation failures provide user feedback via `onError` callback
