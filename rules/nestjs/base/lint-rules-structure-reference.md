# Lint Rules — Structure Reference (nestjs/base)

> 이 문서는 `rules/nestjs/base/eslint.base.mjs` 의 `baseBoundaryElements` 및 `baseStructureAnnotations` 에서 자동 생성됩니다.
> **수동 편집 금지** — 변경은 `.mjs` 에서 하고 `node scripts/gen-lint-reference.mjs`를 다시 실행하세요.

## 개요

아키텍처 경계 선언 — 각 레이어가 어떤 경로에 해당하는지 정의.
헥사고날 폴더 구조 (모듈당):
  src/modules/<feature>/
    ├── model/         — 엔티티/값 객체 (순수 TS, 최하위)
    ├── port/          — 도메인 인터페이스 (Repository 등)
    ├── service/       — UseCase, 비즈니스 로직 (Port 주입받음)
    ├── controller/    — HTTP 어댑터
    ├── provider/      — Port 구현체 (ORM/외부 SDK 호출)
    ├── exception/     — 도메인 예외
    └── dto/           — 입출력 경계 타입 (@ApiProperty 강제)

추가:
  src/common/         — 프로젝트 전역 공용 (유틸, 상수, 공용 예외 기반)
  src/infrastructure/ — 인프라 수평 관심사 (로거, DB 커넥션 등)
  src/libs/           — 독립 라이브러리성 모듈 (자유도 높음)

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 유연하게 매칭하므로 `[feature]`, `(group)`, `[id]` 같은 placeholder 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다. `[locale]`처럼 리터럴 bracket은 lint가 강제합니다.

```
└── src/
    ├── modules/
    │   └── **
    │       ├── model/
    │       │   └── **       # model — 도메인 모델
    │       ├── port/
    │       │   └── **       # port — 도메인 Port 인터페이스
    │       ├── service/
    │       │   └── **       # service — UseCase
    │       ├── controller/
    │       │   └── **       # controller — HTTP 컨트롤러
    │       ├── provider/
    │       │   └── **       # provider — Port 구현체
    │       ├── exception/
    │       │   └── **       # exception — 도메인 예외
    │       └── dto/
    │           └── **       # dto — 요청/응답 DTO
    ├── common/
    │   └── **               # common — 전역 공용
    ├── infrastructure/
    │   └── **               # infrastructure — 인프라 수평 관심사
    └── libs/
        └── **               # libs — 독립 라이브러리
```

## 레이어별 경로 매핑

| 타입 | 경로 패턴 | 모드 | 설명 |
| --- | --- | --- | --- |
| `model` | `src/modules/**/model/**` | — | 도메인 모델 |
| `port` | `src/modules/**/port/**` | — | 도메인 Port 인터페이스 |
| `service` | `src/modules/**/service/**` | — | UseCase |
| `controller` | `src/modules/**/controller/**` | — | HTTP 컨트롤러 |
| `provider` | `src/modules/**/provider/**` | — | Port 구현체 |
| `exception` | `src/modules/**/exception/**` | — | 도메인 예외 |
| `dto` | `src/modules/**/dto/**` | — | 요청/응답 DTO |
| `common` | `src/common/**` | — | 전역 공용 |
| `infrastructure` | `src/infrastructure/**` | — | 인프라 수평 관심사 |
| `libs` | `src/libs/**` | — | 독립 라이브러리 |
