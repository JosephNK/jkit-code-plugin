<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nextjs/email-template/eslint.rules.mjs (emailTemplateBoundaryElements) -->

# Lint Rules — Structure Reference (nextjs/email-template)

## 개요

`src/lib/email-templates` 디렉토리를 `email-template` element로 등록.
이메일 전송 시 서버에서 렌더링되는 템플릿 전용 공간.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 유연하게 매칭하므로 `[feature]`, `(group)`, `[id]` 같은 placeholder 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다. `[locale]`처럼 리터럴 bracket은 lint가 강제합니다.

```
└── src/
    └── lib/
        └── email-templates/  # email-template
```

## 레이어별 경로 매핑

| 타입 | 경로 패턴 | 모드 | 설명 |
| --- | --- | --- | --- |
| `email-template` | `src/lib/email-templates` | — | — |
