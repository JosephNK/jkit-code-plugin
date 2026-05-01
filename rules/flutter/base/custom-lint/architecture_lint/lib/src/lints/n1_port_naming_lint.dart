import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';

/// N1: 클래스명에 `Port` suffix 필수 (예: `AuthPort`, `UserRepositoryPort`).
///
/// 클래스명만으로 레이어 역할을 즉시 식별 — grep/리뷰 효율.
class N1PortNamingLint extends DartLintRule {
  const N1PortNamingLint() : super(code: _code);

  static const _code = LintCode(
    name: 'n1_port_naming',
    problemMessage: "Port classes must end with 'Port'.",
    correctionMessage:
        "Rename the class to end with 'Port' "
        "(e.g., AuthPort, UserRepositoryPort).",
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
      if (classifyLayer(filePath) != 'ports') return;

      final name = node.name;
      if (!name.lexeme.endsWith('Port')) {
        reporter.atToken(name, code);
      }
    });
  }
}
