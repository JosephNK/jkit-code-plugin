<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/flutter/gen-custom-lint-reference.mjs -->
<!-- Source: rules/flutter/base/custom-lint/architecture_lint/lib/src/ (boundary_element.dart, structure_annotation.dart) -->

# Lint Rules — Structure Reference (flutter/base)

## 개요

아키텍처 boundary 정의 — 각 layer ↔ 경로 패턴 매핑. `boundary_element.dart`의 `projectBoundaryElements`가 lint 분류와 doc 트리의 단일 source이며, `structure_annotation.dart`가 placeholder/하위 폴더 의도를 트리에 보강한다.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 glob(`**`, `*`) 기반으로 매칭하므로 `<feature>`, `<service>`, `<package>` 같은 placeholder 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다.

```
Root (Melos workspace)
├── app/
│   └── lib/
│       ├── common/                       # 모든 feature 공유
│       │   ├── database/                 # 로컬 DB 테이블/DAO/마이그레이션
│       │   │   ├── tables/
│       │   │   └── daos/
│       │   ├── env/                      # Env 설정 (envied)
│       │   ├── events/                   # 앱 전역 event bus
│       │   ├── exceptions/               # 공용 예외 정의
│       │   ├── extensions/               # Dart extensions
│       │   ├── services/                 # 교차 feature 서비스
│       │   │   └── <service>/            # Port & Adapter 패턴
│       │   │       ├── *_port.dart
│       │   │       ├── *_adapter.dart
│       │   │       └── support/          # 보조 구현 파일 (config/types/helpers 등) — 서비스 구현 디테일
│       │   │           └── *.dart
│       │   ├── theme/                    # 디자인 시스템
│       │   └── widgets/                  # 공용 재사용 위젯
│       ├── di/
│       │   └── injection_container.dart  # get_it 설정
│       ├── features/                     # Feature 모듈
│       │   └── <feature>/
│       │       ├── domain/
│       │       │   ├── entities/         # Immutable Value Objects
│       │       │   ├── exceptions/       # 도메인 예외
│       │       │   ├── ports/            # Abstract interfaces (*_port.dart)
│       │       │   └── usecases/         # 비즈니스 로직 (*_usecase.dart)
│       │       ├── infrastructure/
│       │       │   └── adapters/         # Port 구현체 (*_adapter.dart)
│       │       └── presentation/
│       │           ├── bloc/             # 상태 관리 (선택)
│       │           ├── pages/            # Screen entry points
│       │           ├── views/            # 논리적 뷰 섹션
│       │           └── widgets/          # Feature 전용 위젯
│       ├── router/
│       │   └── router.dart               # GoRouter 설정
│       ├── app.dart                      # 앱 root 위젯
│       └── main.dart                     # 진입점
└── packages/
    └── <package>/                        # 공용 / 자동 생성 패키지
        └── src/
            ├── api/<api_name>/           # OpenAPI 자동 생성 클라이언트
            │   ├── models/
            │   ├── services/
            │   └── endpoints.dart
            └── database/                 # 로컬 DB 테이블/DAO/마이그레이션
                ├── tables/
                └── daos/
```

## 레이어별 경로 매핑

| 레이어 | 경로 패턴 | 비고 |
| --- | --- | --- |
| `entities` | `app/lib/features/**/domain/entities/**` | Immutable Value Objects |
| `ports` | `app/lib/features/**/domain/ports/**` / `app/lib/common/services/*/*_port.dart` | Abstract interfaces (*_port.dart) |
| `usecases` | `app/lib/features/**/domain/usecases/**` | 비즈니스 로직 (*_usecase.dart) |
| `adapters` | `app/lib/features/**/infrastructure/adapters/**` / `app/lib/common/services/*/*_adapter.dart` | Port 구현체 (*_adapter.dart) |
| `bloc` | `app/lib/features/**/presentation/bloc/**` | 상태 관리 (선택) |
| `exceptions` | `app/lib/features/**/domain/exceptions/**` / `app/lib/common/exceptions/**` | 도메인 예외 + 공용 예외 |
| `presentation` | `app/lib/features/**/presentation/pages/**` / `app/lib/features/**/presentation/views/**` / `app/lib/features/**/presentation/widgets/**` | pages / views / widgets 통합 |
| `common_services` | `app/lib/common/services/*/support/**` | support/ 보조 파일 — 교차 feature 서비스 |
| `common` | `app/lib/common/database/**` / `app/lib/common/env/**` / `app/lib/common/events/**` / `app/lib/common/extensions/**` / `app/lib/common/theme/**` / `app/lib/common/widgets/**` | 공용 — lint 룰 적용 없음 |

## Ignore 패턴 (S2)

`S2` 룰이 통과시키는 합법 path glob — boundary 외 경로지만 허용된다 (부트스트랩·DI·라우터 등). NestJS의 `baseBoundaryIgnores`에 대응.

- `app/lib/main.dart`
- `app/lib/app.dart`
- `app/lib/di/**`
- `app/lib/router/**`

