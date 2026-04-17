# 구현 계획: architecture_lint — candies_analyzer_plugin 의존성 제거

## 생성일
2026-04-17

## 요구사항
- `rules/flutter/custom-lint/architecture_lint` 패키지의 `candies_analyzer_plugin` 런타임 의존성을 **완전 제거**한다.
- `analyzer` + `analyzer_plugin` 순정 API로 동등 기능을 재구현한다.
- 기존 11개 lint 규칙 (E1~E7, N1~N3, S1) **동작 유지**.
- candies는 구현 참조용으로만 활용 (런타임 의존 X, 코드 참조 X).

## 현재 상태
- `pubspec.yaml` — `candies_analyzer_plugin: any` 의존성 선언
- `lib/src/architecture_lint_plugin.dart` — `CandiesAnalyzerPlugin` 상속
- `lib/src/lints/*.dart` 11개 — candies의 `DartLint` 상속, `matchLint(AstNode) → SyntacticEntity?` 패턴
- `lib/src/classification.dart`, `lib/src/constants.dart` — candies **비의존**, 그대로 재사용
- `tools/analyzer_plugin/bin/plugin.dart` — `CandiesAnalyzerPluginStarter.start` 사용
- `tools/analyzer_plugin/pubspec.yaml` — candies 의존 선언

## 리스크
- **HIGH**: `ServerPlugin` API는 analyzer 버전(6.x~7.x)별 시그니처 차이가 있어 호환 범위 유지 시 조건부 구현 필요.
- **HIGH**: 플러그인 부팅·isolate·분석 파이프라인(candies가 추상화하던 부분)을 직접 구현해야 함.
- **MEDIUM**: `matchLint`/`DartLint` 시그니처를 자체 추상으로 유지해야 11개 lint 본문 최소 수정 가능.
- **MEDIUM**: `AnalysisErrorSeverity`, `AnalysisError` 매핑 로직 자체 작성.
- **LOW**: 실 Flutter 앱 연동 수동 검증 필요.

## 구현 단계

### Phase 1 — 자체 `DartLint` 추상 정의
- `lib/src/dart_lint.dart` 생성
- candies와 동일 시그니처 유지 (`code`, `message`, `severity`, `correction`, `matchLint`)

### Phase 2 — `ServerPlugin` 기반 베이스 플러그인 재작성
- `lib/src/architecture_lint_plugin.dart` 를 `extends ServerPlugin`으로 재작성
- `handleAnalysisSetContextRoots`, 파일 분석 드라이버 구성
- 각 Dart 파일 CompilationUnit → 11개 lint에 대해 AST 순회 → `matchLint` → `AnalysisError` 수집·전송

### Phase 3 — isolate 엔트리포인트 전환
- `tools/analyzer_plugin/bin/plugin.dart`를 analyzer_plugin 표준 `ServerPlugin.start` 호출로 교체
- `tools/analyzer_plugin/pubspec.yaml`에서 candies 제거

### Phase 4 — 메인 `pubspec.yaml` 정리
- `candies_analyzer_plugin: any` 제거

### Phase 5 — 11개 lint 파일 import 교체
- `package:candies_analyzer_plugin/...` → `../dart_lint.dart`
- 시그니처 호환 시 본문 무변경

### Phase 6 — 검증
- `dart pub get`, `dart analyze` 통과
- 실 Flutter 프로젝트에 연동 → lint 메시지 출력 확인 (수동)

## 의존성
- `analyzer` (유지)
- `analyzer_plugin` (유지, 주력)
- `path` (유지)
- `candies_analyzer_plugin` (**제거**)

## 대안 검토
- **(A) 제안안**: 자체 DartLint + ServerPlugin 직접 구현 — **채택**
- (B) `custom_lint` 패키지 활용 — 의존성 교체이므로 요구사항(analyzer + analyzer_plugin 순정)과 어긋남
- (C) candies fork 내재화 — 의존성 제거 목적과 어긋남

## 예상 복잡도: HIGH

## 승인 상태
- 사용자 승인: 2026-04-17
