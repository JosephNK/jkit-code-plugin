/// JKit Flutter — Architecture Lint Package
///
/// Flutter 프로젝트의 Clean Architecture + Feature-first 구조를 정적 분석으로 강제하는
/// analyzer plugin.
///
/// ## 룰 요약 (13종)
///
/// ### 의존성 규칙 (E1~E8) — ERROR
/// - **E1** `e1_entities_import`        : entities/는 codegen 어노테이션만 import 허용
/// - **E2** `e2_usecases_dependency`    : usecases/는 entities/ports/exceptions만 참조
/// - **E3** `e3_bloc_dependency`        : bloc/은 usecases/entities/exceptions만 참조
/// - **E4** `e4_domain_no_sdk`          : 도메인 레이어에 외부 인프라 SDK 금지
/// - **E5** `e5_ports_no_framework`     : ports/에 프레임워크 패키지 금지 (flutter 포함)
/// - **E6** `e6_cross_feature`          : 다른 feature의 내부 레이어 cross-import 금지
/// - **E7** `e7_no_bare_catch`          : bare `catch (e)` 금지 (타입 명시 강제)
/// - **E8** `e8_presentation_dependency`: presentation/은 adapters/ports/usecases 및 인프라 SDK 직접 import 금지
///
/// ### 네이밍 규칙 (N1~N3) — WARNING
/// - **N1** `n1_port_naming`          : Port 클래스 이름은 `Port` 접미사
/// - **N2** `n2_adapter_naming`       : Adapter 클래스 이름은 `Adapter` 접미사
/// - **N3** `n3_usecase_naming`       : UseCase 클래스는 `UseCase` 또는 `Params` 접미사
///
/// ### 사이즈/구조 규칙 (S1~S2)
/// - **S1** `s1_file_size`            : 파일당 800줄 이하 (WARNING)
/// - **S2** `s2_unknown_path`         : `app/lib/` 안에서 boundary 외 경로 금지 (ERROR)
///
/// ## 디렉토리 구조
/// - `src/constants.dart`            — 패키지 리스트, 레이어 집합, 상수
/// - `src/boundary_element.dart`     — projectBoundaryElements (lint 분류 + 트리 단일 source)
/// - `src/structure_annotation.dart` — placeholder/하위 폴더 의도 (트리 보강, doc-only)
/// - `src/classification.dart`       — 파일 경로 → 레이어/feature 분류 헬퍼
/// - `src/dart_lint.dart`            — 모든 룰의 베이스 `DartLint` 추상 클래스
/// - `src/runner.dart`               — AST 방문자 + 룰 레지스트리
/// - `src/architecture_lint_plugin.dart` — analyzer_plugin `ServerPlugin` 구현
/// - `src/lints/`                    — 각 룰 구현체
library architecture_lint;

export 'src/architecture_lint_plugin.dart';
export 'src/boundary_element.dart';
export 'src/classification.dart';
export 'src/constants.dart';
export 'src/dart_lint.dart';
export 'src/runner.dart';
export 'src/structure_annotation.dart';
export 'src/lints/e1_entities_import_lint.dart';
export 'src/lints/e2_usecases_dependency_lint.dart';
export 'src/lints/bloc/e3_bloc_dependency_lint.dart';
export 'src/lints/e4_domain_no_sdk_lint.dart';
export 'src/lints/e5_ports_no_framework_lint.dart';
export 'src/lints/e6_cross_feature_lint.dart';
export 'src/lints/e7_no_bare_catch_lint.dart';
export 'src/lints/e8_presentation_dependency_lint.dart';
export 'src/lints/n1_port_naming_lint.dart';
export 'src/lints/n2_adapter_naming_lint.dart';
export 'src/lints/n3_usecase_naming_lint.dart';
export 'src/lints/s1_file_size_lint.dart';
export 'src/lints/s2_unknown_path_lint.dart';
