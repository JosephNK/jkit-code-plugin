import 'package:analyzer/error/listener.dart';
import 'package:analyzer/error/error.dart' show DiagnosticSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

import '../helpers.dart';

/// FZ_E1: entities/ 클래스는 `@freezed` annotation 필수 — 도메인 모델 불변성 보장.
///
/// codegen 산출물(`.freezed.dart`/`.g.dart`)과 `_` 프리픽스 private class는 검사 제외.
class FzE1EntitiesFreezedLint extends DartLintRule {
  const FzE1EntitiesFreezedLint() : super(code: _code);

  static const _code = LintCode(
    name: 'fz_e1_entities_freezed',
    problemMessage:
        'entities/ classes must be annotated with @freezed.',
    correctionMessage:
        'Add @freezed and convert to abstract class with const factory + _\$ClassName mixin '
        '(e.g., `@freezed abstract class User with _\$User { const factory User({...}) = _User; }`).',
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
      if (!isEntitiesFile(filePath)) return;

      final name = node.name.lexeme;
      if (name.startsWith('_')) return;

      if (hasFreezedAnnotation(node)) return;
      reporter.atToken(node.name, code);
    });
  }
}
