## GoRouter

- Dynamic parameters: `state.pathParameters['id']`
- Object passing: `state.extra as ParamsType`
- Auth guard: global `redirect` checks `TokenStoragePort.hasTokens()`
- `pageBuilder` for custom transitions (e.g., `NoTransitionPage`), `builder` for default transitions
