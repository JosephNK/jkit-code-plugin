import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

/// E7: No bare catch statements.
///
/// Must use typed catch: `on ExceptionType catch (e)`.
class E7NoBareCatchLint extends DartLint {
  @override
  String get code => 'e7_no_bare_catch';

  @override
  String get message =>
      "Bare catch is not allowed. Use 'on ExceptionType catch (e)' instead.";

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      "Specify the exception type: 'on SpecificException catch (e)'.";

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! CatchClause) return null;

    // A bare catch has no exception type (no 'on' keyword)
    if (node.exceptionType == null) {
      return node.catchKeyword ?? node;
    }

    return null;
  }
}
