import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../dart_lint.dart';

/// E7: `catch (e)` 단독 사용(bare catch) 금지 — 반드시 타입 명시.
///
/// ## 이유
/// bare `catch (e)`는 `Object`를 모두 잡아서 다음 문제를 일으킨다:
///   - 프로그래밍 버그(Error 계열, StackOverflowError 등)도 삼켜 디버깅 불가
///   - 서로 다른 실패 유형(네트워크/파싱/권한)을 구분 못 하고 일괄 처리
///   - 린트/분석기가 추적할 수 없는 ex 타입이 되어 IDE 지원 악화
///
/// ## 올바른 형태
///   on NetworkException catch (e) { ... }
///   on FormatException catch (e) { ... }
///
/// ## Dart/Flutter 가이드 (rules/dart/coding-style.md)
/// - `on` 절로 특정 예외 타입만 잡는다
/// - `Error` 계열은 절대 catch하지 않는다 (프로그래밍 버그 표시)
/// - Result 타입/sealed class로 회복 가능한 에러를 표현한다
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
