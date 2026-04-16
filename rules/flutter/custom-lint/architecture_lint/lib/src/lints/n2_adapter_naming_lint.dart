import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

import '../classification.dart';

/// N2: Adapter classes must end with 'Adapter'.
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

    final className = node.name.lexeme;
    if (!className.endsWith('Adapter')) {
      return node.name;
    }

    return null;
  }
}
