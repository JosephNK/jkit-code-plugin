<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nextjs/mongodb/eslint.rules.mjs (mongodbBoundaryElements) -->

# Lint Rules — Structure Reference (nextjs/mongodb)

## 개요

DB 드라이버 래퍼 디렉토리를 새로운 boundary element로 등록.
`src/lib/db` 는 MongoClient 초기화·커넥션 풀 관리 등 DB 인프라 전담.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 유연하게 매칭하므로 `[feature]`, `(group)`, `[id]` 같은 placeholder 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다. `[locale]`처럼 리터럴 bracket은 lint가 강제합니다.

```
└── src/
    └── lib/
        └── db/  # db
```

## 레이어별 경로 매핑

| 타입 | 경로 패턴 | 모드 | 설명 |
| --- | --- | --- | --- |
| `db` | `src/lib/db` | — | — |
