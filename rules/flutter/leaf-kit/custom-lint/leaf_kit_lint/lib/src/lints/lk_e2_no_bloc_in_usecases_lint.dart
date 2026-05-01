import 'package:analyzer/error/listener.dart';
import 'package:analyzer/error/error.dart' show DiagnosticSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

import '../helpers.dart';

/// LK_E2: usecases/는 bloc/ import 금지.
///
/// 의존 방향 역전 방지 — UseCase는 BLoC을 알 필요 없다 (presentation이
/// usecase를 호출). bloc → usecase는 정상, usecase → bloc은 archi 위반.
class LkE2NoBlocInUsecasesLint extends DartLintRule {
  const LkE2NoBlocInUsecasesLint() : super(code: _code);

  static const _code = LintCode(
    name: 'lk_e2_no_bloc_in_usecases',
    problemMessage:
        'usecases/ must not import bloc/ — UseCase belongs to domain layer '
        'and must not depend on presentation state management.',
    correctionMessage:
        'Remove bloc/ import. UseCase should expose pure domain interfaces '
        'and be called from bloc, not the other way around.',
    errorSeverity: DiagnosticSeverity.ERROR,
  );

  @override
  void run(
    CustomLintResolver resolver,
    DiagnosticReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addImportDirective((node) {
      final filePath = resolver.path;
      if (!isUsecaseFile(filePath)) return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;
      if (isDartImport(importUri)) return;

      final projectPkg = getProjectPackageName(node);
      final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
      if (targetLayer == 'bloc') {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
