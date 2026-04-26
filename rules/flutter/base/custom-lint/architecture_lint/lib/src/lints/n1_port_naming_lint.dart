import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// N1: 클래스명에 `Port` suffix 필수 (예: `AuthPort`, `UserRepositoryPort`).
///
/// 클래스명만으로 레이어 역할을 즉시 식별 — grep/리뷰 효율.
class N1PortNamingLint extends DartLint {
  @override
  String get code => 'n1_port_naming';

  @override
  String get message => "Port classes must end with 'Port'.";

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.WARNING;

  @override
  String? get correction =>
      "Rename the class to end with 'Port' "
      "(e.g., AuthPort, UserRepositoryPort).";

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ClassDeclaration) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'ports') return null;

    final name = node.namePart.typeName;
    if (!name.lexeme.endsWith('Port')) {
      return name;
    }

    return null;
  }
}
