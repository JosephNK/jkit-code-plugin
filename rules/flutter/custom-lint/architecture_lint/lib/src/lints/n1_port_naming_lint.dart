import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

import '../classification.dart';

/// N1: Port classes must end with 'Port'.
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

    final className = node.name.lexeme;
    if (!className.endsWith('Port')) {
      return node.name;
    }

    return null;
  }
}
