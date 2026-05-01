import 'package:analyzer/error/listener.dart';
import 'package:analyzer/error/error.dart' show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

import '../helpers.dart';

/// FZ_E2: bloc/의 `*Event`/`*State` 클래스는 `@freezed` annotation 필수 — sealed 패턴 강제.
///
/// codegen 산출물과 `_` 프리픽스 private class는 검사 제외.
class FzE2BlocEventStateFreezedLint extends DartLintRule {
  const FzE2BlocEventStateFreezedLint() : super(code: _code);

  static const _code = LintCode(
    name: 'fz_e2_bloc_event_state_freezed',
    problemMessage:
        'bloc/ Event and State classes must be annotated with @freezed.',
    correctionMessage:
        'Add @freezed and convert to sealed class with named factory constructors '
        '(e.g., `@freezed sealed class FooEvent with _\$FooEvent { const factory FooEvent.x() = _X; }`).',
    errorSeverity: ErrorSeverity.ERROR,
  );

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addClassDeclaration((node) {
      final filePath = resolver.path;
      if (isGeneratedFile(filePath)) return;
      if (!isBlocFile(filePath)) return;

      final name = node.name.lexeme;
      if (name.startsWith('_')) return;
      if (!name.endsWith('Event') && !name.endsWith('State')) return;

      if (hasFreezedAnnotation(node)) return;
      reporter.atToken(node.name, code);
    });
  }
}
