<!-- GENERATED DOCUMENT - DO NOT MODIFY BY HAND -->
<!-- Generator: scripts/flutter/gen-architecture-lint-reference.mjs -->
<!-- Source: rules/flutter/base/custom-lint/architecture_lint/lib/src/ (classification.dart) -->

# Lint Rules — Structure Reference (flutter/base)

## 개요

아키텍처 레이어 ↔ 폴더 매핑. `classification.dart`의 `_layerMarkers`가 런타임에 파일 경로를 레이어로 분류하며, 모든 E/N/S 룰이 이 분류를 통해 대상 파일을 필터링한다.

## 프로젝트 구조

> 아래 트리는 **대표 구조 예시**입니다. lint는 디렉토리 이름 매칭(`/<dir>/`)으로 레이어를 판정하므로 `<feature>`, `<service>` 같은 가변 세그먼트의 실제 이름은 프로젝트마다 다를 수 있습니다.

```
Root (Melos workspace)
├── app/
│   └── lib/
│       ├── common/                      # 모든 feature 공유
│       │   ├── env/                     # Env 설정 (envied)
│       │   ├── events/                  # 앱 전역 event bus
│       │   ├── exceptions/              # 공용 예외 정의
│       │   ├── extensions/              # Dart extensions
│       │   ├── services/                # 교차 feature 서비스
│       │   │   └── <service>/           # Port & Adapter 패턴
│       │   │       ├── *_port.dart
│       │   │       └── *_adapter.dart
│       │   ├── theme/                   # 디자인 시스템
│       │   └── widgets/                 # 공용 재사용 위젯
│       ├── di/
│       │   └── injection_container.dart # get_it 설정
│       ├── features/                    # Feature 모듈
│       │   └── <feature>/
│       │       ├── domain/
│       │       │   ├── entities/        # Immutable Value Objects
│       │       │   ├── exceptions/      # 도메인 예외
│       │       │   ├── ports/           # Abstract interfaces (*_port.dart)
│       │       │   └── usecases/        # 비즈니스 로직 (*_usecase.dart)
│       │       ├── infrastructure/
│       │       │   └── adapters/        # Port 구현체 (*_adapter.dart)
│       │       └── presentation/
│       │           ├── bloc/            # 상태 관리 (선택)
│       │           ├── pages/           # Screen entry points
│       │           ├── views/           # 논리적 뷰 섹션
│       │           └── widgets/         # Feature 전용 위젯
│       ├── router/
│       │   └── router.dart              # GoRouter 설정
│       ├── app.dart                     # 앱 root 위젯
│       └── main.dart                    # 진입점
└── packages/
    └── <package>/                       # 공용 / 자동 생성 패키지
        └── src/
            ├── api/<api_name>/          # OpenAPI 자동 생성 클라이언트
            │   ├── models/
            │   ├── services/
            │   └── endpoints.dart
            └── database/                # 로컬 DB 테이블/DAO/마이그레이션
                ├── tables/
                └── daos/
```

## 레이어별 경로 매핑

| 디렉토리 | 레이어 | 비고 |
| --- | --- | --- |
| `entities` | `entities` | — |
| `ports` | `ports` | — |
| `usecases` | `usecases` | — |
| `adapters` | `adapters` | — |
| `bloc` | `bloc` | — |
| `exceptions` | `exceptions` | — |
| `pages` / `views` / `widgets` | `presentation` | 여러 디렉토리가 같은 레이어로 집계 |
| `common/services/<service>/` | `common_services` | classification.dart 의 fallback 분기 |

