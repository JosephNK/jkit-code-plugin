import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// N2: adapters/ 레이어의 클래스는 이름이 `Adapter`로 끝나야 한다.
///
/// ## 이유
/// Port(인터페이스)와 Adapter(구현체)의 역할 구분을 이름에서 명시적으로 드러낸다.
/// 예: `AuthPort` 인터페이스 ↔ `AuthAdapter` 또는 `ApiAuthAdapter` 구현.
///
/// 구현체가 여러 개(`Api`, `Mock`, `Local`) 있을 때도 접두사+`Adapter`로 일관성 유지.
///
/// ## 심각도
/// WARNING
class N2AdapterNamingLint extends DartLint {
  @override
  String get code => 'n2_adapter_naming';

  @override
  String get message => "Adapter classes must end with 'Adapter'.";

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.WARNING;

  @override
  String? get correction =>
      "Rename the class to end with 'Adapter' "
      "(e.g., AuthAdapter, ApiUserAdapter).";

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ClassDeclaration) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'adapters') return null;

    final name = node.namePart.typeName;
    if (!name.lexeme.endsWith('Adapter')) {
      return name;
    }

    return null;
  }
}
