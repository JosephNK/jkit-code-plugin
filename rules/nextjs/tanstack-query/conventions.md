## Tanstack

Use TanStack Query for all server state management.

### Retry — Single Source (ky transport layer)

- Retry is owned by the ky client (`createApiClient` `DEFAULT_RETRY`), not by TanStack Query.
- ky covers every call site (SSR, route handlers, browser); TanStack Query only wraps client-side hooks, so keeping retry in ky avoids losing it on the server.
- Disable RQ retry to prevent request multiplication — RQ default (3) × ky (2 on GET) compounds into many requests per call:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false }, // ky owns retry
    mutations: { retry: false },
  },
});
```

- To tune retry, change `createApiClient({ retry })` — not the QueryClient.

### Error Handling — Hook Layer (TanStack Query)

- `useQuery` with `throwOnError: false` (default) — Hook returns `error` object
- Global error handling via `QueryClient`'s `onError` callback (toast, logging)
- Mutation failures provide user feedback via `onError` callback
