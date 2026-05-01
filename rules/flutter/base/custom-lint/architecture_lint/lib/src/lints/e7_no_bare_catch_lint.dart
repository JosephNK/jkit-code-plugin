import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

/// E7: bare `catch` 금지 — `on ExceptionType catch (e)` 형태 강제.
///
/// 의도한 예외만 처리하고 프로그래밍 오류(`Error` 계열)는 전파한다.
class E7NoBareCatchLint extends DartLintRule {
  const E7NoBareCatchLint() : super(code: _code);

  static const _code = LintCode(
    name: 'e7_no_bare_catch',
    problemMessage:
        "Bare catch is not allowed. Use 'on ExceptionType catch (e)' instead.",
    correctionMessage:
        "Specify the exception type: 'on SpecificException catch (e)'.",
    errorSeverity: ErrorSeverity.ERROR,
  );

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addCatchClause((node) {
      // A bare catch has no exception type (no 'on' keyword)
      if (node.exceptionType != null) return;
      final keyword = node.catchKeyword;
      if (keyword != null) {
        reporter.atToken(keyword, code);
      } else {
        reporter.atNode(node, code);
      }
    });
  }
}
