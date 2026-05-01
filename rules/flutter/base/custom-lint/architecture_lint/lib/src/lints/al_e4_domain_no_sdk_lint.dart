import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show DiagnosticSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';
import '../constants.dart';

/// AL_E4: 도메인 레이어(entities/ports/usecases/exceptions)는 인프라 SDK import 금지.
///
/// 테스트 가능성·이식성 보장 — 인프라 접근은 `adapters/`에서만.
/// 금지 목록은 `infraPackages` (dio·http·drift·sqflite·firebase 계열 등).
class AlE4DomainNoSdkLint extends DartLintRule {
  const AlE4DomainNoSdkLint() : super(code: _code);

  static const _code = LintCode(
    name: 'al_e4_domain_no_sdk',
    problemMessage:
        'External SDK packages must not be imported in domain layers '
        '(entities/, ports/, usecases/, exceptions/).',
    correctionMessage:
        'Move infrastructure dependencies to adapters/ and define '
        'abstractions in ports/.',
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
      final layer = classifyLayer(filePath);
      if (!domainLayers.contains(layer)) return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;

      final packageName = extractImportPackageName(importUri);
      if (packageName == null) return;

      // Same project imports are fine
      final projectPkg = getProjectPackageName(node);
      if (packageName == projectPkg) return;

      if (infraPackages.contains(packageName)) {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
