import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show DiagnosticSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';

/// AL_N3: 클래스명에 `UseCase` 또는 `Params` suffix 필수 (예: `GetUserUseCase`, `GetUserParams`).
///
/// `*UseCase` = Command/Query 객체, `*Params` = 입력 캡슐 — 폴더에 헬퍼·유틸 혼입 방지.
class AlN3UseCaseNamingLint extends DartLintRule {
  const AlN3UseCaseNamingLint() : super(code: _code);

  static const _code = LintCode(
    name: 'al_n3_usecase_naming',
    problemMessage: "UseCase classes must end with 'UseCase' or 'Params'.",
    correctionMessage:
        "Rename the class to end with 'UseCase' "
        "(e.g., GetUserUseCase) or 'Params' (e.g., GetUserParams).",
    errorSeverity: DiagnosticSeverity.WARNING,
  );

  @override
  void run(
    CustomLintResolver resolver,
    DiagnosticReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addClassDeclaration((node) {
      final filePath = resolver.path;
      if (classifyLayer(filePath) != 'usecases') return;

      final name = node.name;
      final lex = name.lexeme;
      if (!lex.endsWith('UseCase') && !lex.endsWith('Params')) {
        reporter.atToken(name, code);
      }
    });
  }
}
