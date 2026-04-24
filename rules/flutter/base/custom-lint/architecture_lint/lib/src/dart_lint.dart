import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;

/// 프로젝트 내부 Lint 규칙의 베이스 추상 클래스.
///
/// 기존에 `candies_analyzer_plugin`의 `DartLint`를 상속하던 구조를
/// analyzer + analyzer_plugin 순정 API 기반으로 재구현하기 위한 대체.
/// 시그니처는 candies와 동일하게 유지하여 각 규칙 본문의 수정을 최소화한다.
abstract class DartLint {
  /// 고유 규칙 ID (예: `e1_entities_import`).
  String get code;

  /// 진단 메시지 본문.
  String get message;

  /// 심각도. `AnalysisErrorSeverity.ERROR` / `WARNING` / `INFO`.
  AnalysisErrorSeverity get severity;

  /// 선택적 수정 안내 문구.
  String? get correction;

  /// AST 노드를 검사해 위반일 경우 강조할 `SyntacticEntity`를 반환한다.
  /// 위반이 아니면 null.
  SyntacticEntity? matchLint(AstNode node);
}
