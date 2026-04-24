import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../constants.dart';
import '../dart_lint.dart';

/// S1: 파일 라인 수 상한 (기본 800).
///
/// ## 이유
/// 800줄을 넘는 파일은 단일 책임 원칙(SRP) 위반 가능성이 높고:
///   - 코드 리뷰 부담 증가
///   - 병합 충돌(merge conflict) 확률 증가
///   - IDE 탐색성 저하
///   - 테스트 작성 시 mock 범위가 넓어짐
///
/// 공통 규칙 rules/common/coding-style.md ("200-400 typical, 800 max") 와 일치.
///
/// ## 심각도
/// WARNING — 즉시 실패가 아니라 분할 검토 요청.
///
/// ## 한계값 조정
/// constants.dart 의 `maxFileLines` 상수 수정으로 프로젝트별 조정 가능.
class S1FileSizeLint extends DartLint {
  @override
  String get code => 's1_file_size';

  @override
  String get message =>
      'File exceeds the maximum line count ($maxFileLines lines). '
      'Consider splitting into smaller files.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.WARNING;

  @override
  String? get correction =>
      'Split this file into smaller, focused files by responsibility.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! CompilationUnit) return null;

    final lineCount = node.lineInfo.lineCount;
    if (lineCount > maxFileLines) {
      return node.beginToken;
    }

    return null;
  }
}
