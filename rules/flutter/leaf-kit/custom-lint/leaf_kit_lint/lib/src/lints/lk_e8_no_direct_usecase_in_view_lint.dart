import 'package:analyzer/error/listener.dart';
import 'package:analyzer/error/error.dart' show DiagnosticSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

import '../helpers.dart';

/// LK_E8: presentation/{pages,views,widgets}에서 usecases/ 직접 import 금지.
/// (bloc/은 예외 — bloc은 usecase를 직접 호출해야 한다)
///
/// View 레이어가 UseCase를 직접 호출하면 BLoC 경유 상태 관리가 우회된다.
/// 데이터/상태 흐름: view → bloc(event) → usecase → repository.
class LkE8NoDirectUsecaseInViewLint extends DartLintRule {
  const LkE8NoDirectUsecaseInViewLint() : super(code: _code);

  static const _code = LintCode(
    name: 'lk_e8_no_direct_usecase_in_view',
    problemMessage:
        'pages/ / views/ / widgets/ must not import usecases/ directly. '
        'Dispatch a bloc event instead — UseCase is called from BLoC.',
    correctionMessage:
        'Define a bloc event and call the UseCase from the bloc handler. '
        'View should only emit events and consume state.',
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
      if (!isPresentationViewFile(filePath)) return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;
      if (isDartImport(importUri)) return;

      final projectPkg = getProjectPackageName(node);
      final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
      if (targetLayer == 'usecases') {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
