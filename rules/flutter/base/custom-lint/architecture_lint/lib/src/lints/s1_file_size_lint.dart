import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../constants.dart';
import '../dart_lint.dart';

/// S1: 파일당 800줄 초과 금지 — 단일 책임 위반 신호.
///
/// 800은 경험적 임계치. 한계값은 `maxFileLines` 상수로 조정 가능.
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
