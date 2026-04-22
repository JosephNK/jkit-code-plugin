<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/gen-lint-reference.mjs -->
<!-- Source: rules/nestjs/base/eslint.base.mjs (baseBoundaryElements, baseStructureAnnotations) -->

# Lint Rules — Structure Reference (nestjs/base)

## 개요

아키텍처 경계 선언 — 각 레이어가 어떤 경로에 해당하는지 정의.

헥사고날 폴더 구조 (모듈당):
  - `src/modules/<group>/<domain>/` 아래에 레이어별 폴더 배치
    (model / port / service / controller / provider / exception / dto)
  - `<group>` 은 선택 — 단층 모듈이면 생략
  - `<domain>.module.ts` 는 DI 조립 파일 (lint 무시 대상)

전역 수평 관심사 (no-unknown-files가 허용 하위 폴더 외 경로를 거부):
  - `src/common/` — authentication, exceptions, interfaces, middlewares, pipes, dtos
  - `src/infrastructure/` — database, i18n, logger, transaction
  - `src/libs/` — 독립 라이브러리성 모듈 (catch-all)

상세 구조/레이어 설명은 아래 "프로젝트 구조" 트리와 "레이어별 경로 매핑" 표 참고.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 유연하게 매칭하므로 `[feature]`, `(group)`, `[id]` 같은 placeholder 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다. `[locale]`처럼 리터럴 bracket은 lint가 강제합니다.

```
└── src/
    ├── modules/
    │   └── <group>/                    # (선택) Group prefix — 실제 이름 가변 (예: user, admin). 단층 구조면 생략 가능
    │       └── <domain>/               # Domain module — 실제 이름 가변 (예: profile, order)
    │           ├── model/              # Entity, Value Object, pure domain functions
    │           ├── port/               # All Port interfaces (inbound + outbound)
    │           ├── service/            # Inbound-port implementation (business logic)
    │           ├── controller/         # Driving Adapter (HTTP)
    │           ├── provider/           # Outbound Adapter (DB, external services)
    │           ├── dto/                # Input/output DTOs
    │           ├── exception/          # Domain-specific exceptions
    │           └── <domain>.module.ts  # NestJS module (DI assembly) — lint ignored via **/*.module.ts
    ├── common/
    │   ├── authentication/             # Guards, auth-related
    │   ├── exceptions/                 # Exception Filters, domain exception base
    │   ├── interfaces/                 # Shared interfaces
    │   ├── middlewares/                # Global middlewares
    │   ├── pipes/                      # Validation Pipes
    │   └── dtos/                       # Shared DTOs
    ├── infrastructure/
    │   ├── database/                   # Database configuration
    │   ├── i18n/                       # Internationalization
    │   ├── logger/                     # Logging
    │   └── transaction/                # Transaction management
    └── libs/
        └── **                          # libs — 독립 라이브러리
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
| `common` | `src/common/authentication/**` / `src/common/exceptions/**` / `src/common/interfaces/**` / `src/common/middlewares/**` / `src/common/pipes/**` / `src/common/dtos/**` | — | 전역 공용 (허용 하위 폴더만) |
| `infrastructure` | `src/infrastructure/database/**` / `src/infrastructure/i18n/**` / `src/infrastructure/logger/**` / `src/infrastructure/transaction/**` | — | 인프라 수평 관심사 (허용 하위 폴더만) |
| `libs` | `src/libs/**` | — | 독립 라이브러리 |
