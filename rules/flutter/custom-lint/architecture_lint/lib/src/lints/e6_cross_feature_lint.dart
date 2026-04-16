import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

import '../classification.dart';
import '../constants.dart';

/// E6: No cross-feature imports of internal layers.
///
/// Exceptions:
/// - entities/ imports are always allowed across features.
/// - presentation/bloc may import other features' domain/ layers.
class E6CrossFeatureLint extends DartLint {
  @override
  String get code => 'e6_cross_feature';

  @override
  String get message =>
      'Cross-feature imports of internal layers (ports/, adapters/, '
      'usecases/, bloc/) are not allowed. '
      'Use DI or event bus for cross-feature communication.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Share types via entities/, inject dependencies through DI, '
      'or use an event bus for cross-feature communication.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final currentFeature = extractFeature(filePath);
    if (currentFeature == null) return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    final projectPkg = getProjectPackageName(node);

    final targetFeature = getImportTargetFeature(
      importUri,
      filePath,
      projectPkg,
    );
    if (targetFeature == null || targetFeature == currentFeature) return null;

    final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);

    // entities/ imports are always allowed across features
    if (targetLayer == 'entities') return null;

    // presentation/bloc may import other features' domain/
    final currentLayer = classifyLayer(filePath);
    if (currentLayer == 'presentation' || currentLayer == 'bloc') {
      if (isImportFromDomain(importUri, filePath, projectPkg)) {
        return null;
      }
    }

    if (targetLayer != null && crossFeatureForbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
