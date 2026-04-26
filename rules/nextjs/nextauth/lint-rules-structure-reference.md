<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/nextauth/eslint.rules.mjs (nextauthBoundaryElements) -->

# Lint Rules — Structure Reference (nextjs/nextauth)

## 개요

`src/auth.ts` 단일 파일만 `auth` element로 등록 — `mode: 'full'` 정확 매칭.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 유연하게 매칭하므로 `[feature]`, `(group)`, `[id]` 같은 placeholder 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다. `[locale]`처럼 리터럴 bracket은 lint가 강제합니다.

```
└── src/
    └── auth.ts  # auth
```

## 레이어별 경로 매핑

| 타입 | 경로 패턴 | 모드 | 설명 |
| --- | --- | --- | --- |
| `auth` | `src/auth.ts` | `full` | — |
