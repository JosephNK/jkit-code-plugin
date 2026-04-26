import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// N2: 클래스명에 `Adapter` suffix 필수 (예: `AuthAdapter`, `ApiUserAdapter`).
///
/// Port ↔ Adapter 역할을 이름에서 구분 (예: `AuthPort` ↔ `AuthAdapter`).
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
