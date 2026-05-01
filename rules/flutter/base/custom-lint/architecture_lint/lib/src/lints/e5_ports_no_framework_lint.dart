import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';
import '../constants.dart';

/// E5: framework 패키지(flutter/dio 등) import 금지 — 시그니처에 framework 타입 노출 차단.
///
/// Port는 추상 인터페이스이므로 도메인 타입만 사용해 구현 교체·테스트 용이성 유지.
/// 금지 목록은 `frameworkPackages` (= `infraPackages` + flutter; BuildContext·dio Response 등 누출 방지).
class E5PortsNoFrameworkLint extends DartLintRule {
  const E5PortsNoFrameworkLint() : super(code: _code);

  static const _code = LintCode(
    name: 'e5_ports_no_framework',
    problemMessage:
        'ports/ must not import framework packages (dio, flutter, etc.). '
        'Use domain types only.',
    correctionMessage:
        'Define port interfaces using only domain types (entities, '
        'exceptions). Framework types belong in adapters/.',
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
      if (classifyLayer(filePath) != 'ports') return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;

      final packageName = extractImportPackageName(importUri);
      if (packageName == null) return;

      // Same project imports are fine
      final projectPkg = getProjectPackageName(node);
      if (packageName == projectPkg) return;

      if (frameworkPackages.contains(packageName)) {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
