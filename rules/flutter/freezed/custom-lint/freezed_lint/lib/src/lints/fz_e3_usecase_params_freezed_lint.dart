import 'package:analyzer/error/listener.dart';
import 'package:analyzer/error/error.dart' show DiagnosticSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

import '../helpers.dart';

/// FZ_E3: usecases/의 `*Params` 클래스는 `@freezed` annotation 필수 — 입력 모델 불변성.
///
/// codegen 산출물과 `_` 프리픽스 private class는 검사 제외.
class FzE3UsecaseParamsFreezedLint extends DartLintRule {
  const FzE3UsecaseParamsFreezedLint() : super(code: _code);

  static const _code = LintCode(
    name: 'fz_e3_usecase_params_freezed',
    problemMessage:
        'usecases/ Params classes must be annotated with @freezed.',
    correctionMessage:
        'Add @freezed and convert to abstract class with const factory + _\$ClassName mixin '
        '(e.g., `@freezed abstract class FooParams with _\$FooParams { const factory FooParams({...}) = _FooParams; }`).',
    errorSeverity: DiagnosticSeverity.ERROR,
  );

  @override
  void run(
    CustomLintResolver resolver,
    DiagnosticReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addClassDeclaration((node) {
      final filePath = resolver.path;
      if (isGeneratedFile(filePath)) return;
      if (!isUsecaseFile(filePath)) return;

      final name = node.name.lexeme;
      if (name.startsWith('_')) return;
      if (!name.endsWith('Params')) return;

      if (hasFreezedAnnotation(node)) return;
      reporter.atToken(node.name, code);
    });
  }
}
