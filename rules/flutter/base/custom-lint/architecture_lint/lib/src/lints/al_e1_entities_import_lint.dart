import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';
import '../constants.dart';

/// AL_E1: codegen annotation 패키지만 외부 import 허용 — 도메인 순수성 유지.
///
/// 외부 런타임 의존성 차단. 허용 목록은 `codegenPackages` (freezed_annotation·json_annotation·meta·collection).
class AlE1EntitiesImportLint extends DartLintRule {
  const AlE1EntitiesImportLint() : super(code: _code);

  static const _code = LintCode(
    name: 'al_e1_entities_import',
    problemMessage:
        'entities/ must only import codegen annotations '
        '(freezed_annotation, json_annotation, meta, collection).',
    correctionMessage:
        'Remove the import or move this code to the adapters/ layer.',
    errorSeverity: ErrorSeverity.ERROR,
  );

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addImportDirective((node) {
      final filePath = resolver.path;
      if (classifyLayer(filePath) != 'entities') return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;

      // dart: imports are always allowed
      if (isDartImport(importUri)) return;

      // Relative imports (project-internal) are OK
      if (!importUri.startsWith('package:')) return;

      final packageName = extractImportPackageName(importUri);
      if (packageName == null) return;

      // Same project imports are allowed
      final projectPackage = getProjectPackageName(node);
      if (packageName == projectPackage) return;

      // Only codegen packages allowed
      if (codegenPackages.contains(packageName)) return;

      reporter.atNode(node.uri, code);
    });
  }
}
