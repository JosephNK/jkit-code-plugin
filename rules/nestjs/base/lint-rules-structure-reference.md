<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/typescript/gen-eslint-reference.mjs -->
<!-- Source: rules/nestjs/base/eslint.rules.mjs (baseBoundaryElements, baseStructureAnnotations) -->

# Lint Rules — Structure Reference (nestjs/base)

## 개요

아키텍처 경계 — 각 레이어 type ↔ 경로 매핑.
레이어별 책임·파일 종류는 `baseLayerSemantics` 참조.

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
    │   ├── interceptors/               # Global Interceptors (logging, transform, timeout)
    │   ├── decorators/                 # Custom decorators (@CurrentUser, @Public 등)
    │   ├── events/                     # Domain/integration event payloads & listeners
    │   ├── model/                      # Cross-module shared domain types (Entity·VO·Type)
    │   ├── dtos/                       # Shared DTOs
    │   ├── config/                     # App-level configuration (env, ConfigModule schemas)
    │   ├── constants/                  # Shared constants (enums, magic numbers, tokens)
    │   └── utils/                      # Pure utility functions (no framework deps)
    ├── infrastructure/
    │   ├── database/                   # Database configuration
    │   ├── i18n/                       # Internationalization
    │   ├── logger/                     # Logging
    │   ├── transaction/                # Transaction management
    │   └── external/                   # External service clients (3rd-party SDK, HTTP client wrappers)
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
| `common` | `src/common/authentication/**` / `src/common/exceptions/**` / `src/common/interfaces/**` / `src/common/middlewares/**` / `src/common/pipes/**` / `src/common/interceptors/**` / `src/common/decorators/**` / `src/common/events/**` / `src/common/model/**` / `src/common/dtos/**` / `src/common/config/**` / `src/common/constants/**` / `src/common/utils/**` | — | 전역 공용 (허용 하위 폴더만) |
| `infrastructure` | `src/infrastructure/database/**` / `src/infrastructure/i18n/**` / `src/infrastructure/logger/**` / `src/infrastructure/transaction/**` / `src/infrastructure/external/**` | — | 인프라 수평 관심사 (허용 하위 폴더만) |
| `libs` | `src/libs/**` | — | 독립 라이브러리 |
