import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';

/// S2: `app/lib/` 안에서 boundary 외 경로 금지 — 구조 일관성 강제.
///
/// `projectBoundaryElements` 패턴에 매칭되지 않는 파일은 `'other'`로 분류되며,
/// `unknownPathIgnores`(부트스트랩/DI/라우터)에도 안 걸리면 위반으로 보고.
/// NestJS `boundaries/no-unknown-files`에 대응. `packages/`, `test/` 등
/// `app/lib/` 외부는 검사 대상이 아니다.
class S2UnknownPathLint extends DartLintRule {
  const S2UnknownPathLint() : super(code: _code);

  static const _code = LintCode(
    name: 's2_unknown_path',
    problemMessage:
        'File is outside any defined architecture boundary. '
        'Move it under a known layer (see lint-rules-structure-reference.md), '
        'or add a new BoundaryElement to boundary_element.dart.',
    correctionMessage:
        'Place the file under a boundary-mapped path (e.g. '
        'features/<feature>/{domain,infrastructure,presentation}/, '
        'common/{services,exceptions,env,events,extensions,theme,widgets}/), '
        'or extend projectBoundaryElements / unknownPathIgnores.',
    errorSeverity: ErrorSeverity.ERROR,
  );

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addCompilationUnit((node) {
      final filePath = resolver.path;
      if (!isInAppLib(filePath)) return;
      if (matchesUnknownPathIgnore(filePath)) return;
      if (classifyLayer(filePath) != 'other') return;

      reporter.atToken(node.beginToken, code);
    });
  }
}
