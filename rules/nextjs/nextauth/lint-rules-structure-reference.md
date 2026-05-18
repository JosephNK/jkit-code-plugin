<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nextjs/nextauth/eslint.rules.mjs (nextauthBoundaryElements) -->

# Lint Rules — Structure Reference (nextjs/nextauth)

## 개요

`src/auth.ts` 단일 파일만 `auth` element로 등록 — `mode: 'full'` 정확 매칭.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. 표기 컨벤션: `<name>` = doc placeholder (실제 폴더는 구체 이름, 예: `<feature>` → `users/`/`products/`). `[name]`/`[...name]`/`(name)` = Next.js 라우팅 컨벤션 (브래킷/괄호가 진짜 폴더명의 일부). lint는 glob(`**`, `*`)로 유연 매칭, `[locale]`처럼 명시된 literal bracket은 그대로 강제합니다.

```
└── src/
    └── auth.ts  # auth
```

## 레이어별 경로 매핑

| 타입 | 경로 패턴 | 모드 | 설명 |
| --- | --- | --- | --- |
| `auth` | `src/auth.ts` | `full` | — |
