import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

import '../classification.dart';

/// E2: usecases/ may only import entities/, ports/, exceptions/.
///
/// Forbidden targets: adapters/, bloc/, presentation/, common_services/.
class E2UsecasesDependencyLint extends DartLint {
  static const _forbidden = <String>{
    'adapters',
    'bloc',
    'presentation',
    'common_services',
  };

  @override
  String get code => 'e2_usecases_dependency';

  @override
  String get message =>
      'usecases/ must not import adapters/, bloc/, or presentation/. '
      'Only entities/, ports/, and exceptions/ are allowed.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Inject dependencies through ports/ and use DI to wire adapters.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'usecases') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    // External packages are checked by E4, skip here
    final packageName = getProjectPackageName(node);
    final targetLayer = getImportTargetLayer(importUri, filePath, packageName);
    if (targetLayer == null) return null;

    if (_forbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
