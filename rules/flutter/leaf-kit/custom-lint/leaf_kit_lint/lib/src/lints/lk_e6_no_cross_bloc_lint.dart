import 'package:analyzer/error/listener.dart';
import 'package:analyzer/error/error.dart' show DiagnosticSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

import '../helpers.dart';

/// LK_E6: feature 간 bloc/ cross-import 금지.
///
/// bloc은 단일 feature 내부 상태 — 다른 feature에서 직접 구독하면 결합도가
/// feature 단위를 깨뜨린다. cross-feature 통신은 entities/event-bus/DI로.
class LkE6NoCrossBlocLint extends DartLintRule {
  const LkE6NoCrossBlocLint() : super(code: _code);

  static const _code = LintCode(
    name: 'lk_e6_no_cross_bloc',
    problemMessage:
        'Cross-feature bloc/ imports are not allowed. '
        'BLoC is feature-internal state — use entities, event bus, or DI '
        'for cross-feature communication.',
    correctionMessage:
        'Move shared types to entities/ or use a feature-agnostic event bus. '
        'Never subscribe directly to another feature\'s BLoC.',
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
      final currentFeature = extractFeature(filePath);
      if (currentFeature == null) return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;
      if (isDartImport(importUri)) return;

      final projectPkg = getProjectPackageName(node);
      final targetFeature = getImportTargetFeature(
        importUri,
        filePath,
        projectPkg,
      );
      if (targetFeature == null || targetFeature == currentFeature) return;

      final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
      if (targetLayer == 'bloc') {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
