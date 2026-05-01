import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';
import '../constants.dart';

/// S1: 파일당 800줄 초과 금지 (codegen 산출물 `*.g.dart` 등 제외) — 단일 책임 위반 신호.
///
/// 800은 경험적 임계치. 한계값은 `maxFileLines` 상수로 조정 가능.
/// 제외 대상은 `generatedFileSuffixes` (build_runner/freezed/auto_route/injectable/mockito).
class S1FileSizeLint extends DartLintRule {
  const S1FileSizeLint() : super(code: _code);

  static const _code = LintCode(
    name: 's1_file_size',
    problemMessage:
        'File exceeds the maximum line count ($maxFileLines lines). '
        'Consider splitting into smaller files.',
    correctionMessage:
        'Split this file into smaller, focused files by responsibility.',
    errorSeverity: ErrorSeverity.WARNING,
  );

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addCompilationUnit((node) {
      final filePath = resolver.path;
      if (isGeneratedFile(filePath)) return;

      final lineCount = node.lineInfo.lineCount;
      if (lineCount > maxFileLines) {
        reporter.atToken(node.beginToken, code);
      }
    });
  }
}
