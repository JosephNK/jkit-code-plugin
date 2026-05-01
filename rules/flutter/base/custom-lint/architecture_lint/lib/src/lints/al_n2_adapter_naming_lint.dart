import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';

/// AL_N2: 클래스명에 `Adapter` suffix 필수 (예: `AuthAdapter`, `ApiUserAdapter`).
///
/// Port ↔ Adapter 역할을 이름에서 구분 (예: `AuthPort` ↔ `AuthAdapter`).
class AlN2AdapterNamingLint extends DartLintRule {
  const AlN2AdapterNamingLint() : super(code: _code);

  static const _code = LintCode(
    name: 'al_n2_adapter_naming',
    problemMessage: "Adapter classes must end with 'Adapter'.",
    correctionMessage:
        "Rename the class to end with 'Adapter' "
        "(e.g., AuthAdapter, ApiUserAdapter).",
    errorSeverity: ErrorSeverity.WARNING,
  );

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addClassDeclaration((node) {
      final filePath = resolver.path;
      if (classifyLayer(filePath) != 'adapters') return;

      final name = node.name;
      if (!name.lexeme.endsWith('Adapter')) {
        reporter.atToken(name, code);
      }
    });
  }
}
