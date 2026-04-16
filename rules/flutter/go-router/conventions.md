## GoRouter

- Dynamic parameters: `state.pathParameters['id']`
- Object passing: `state.extra as ParamsType`
- Auth guard: global `redirect` checks `TokenStoragePort.hasTokens()`
- **Default**: use `builder` (platform default transition — iOS: slide, Android: fade)
- **Custom transition needed**: use `pageBuilder` with `NoTransitionPage`, `CustomTransitionPage`, etc.
