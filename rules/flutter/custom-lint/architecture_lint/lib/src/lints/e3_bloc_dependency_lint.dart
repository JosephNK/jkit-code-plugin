import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

import '../classification.dart';
import '../constants.dart';

/// E3: bloc/ may only import usecases/, entities/, exceptions/.
///
/// Forbidden internal targets: adapters/, ports/, common_services/.
/// External packages: only bloc-related packages and codegen allowed.
class E3BlocDependencyLint extends DartLint {
  static const _forbidden = <String>{'adapters', 'ports', 'common_services'};

  @override
  String get code => 'e3_bloc_dependency';

  @override
  String get message =>
      'bloc/ must not import adapters/ or ports/ directly. '
      'Only usecases/, entities/, and exceptions/ are allowed.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Access data through usecases/ instead of directly importing '
      'adapters/ or ports/.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'bloc') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    if (isDartImport(importUri)) return null;

    // Check external packages
    final importPkg = extractImportPackageName(importUri);
    final projectPkg = getProjectPackageName(node);

    if (importPkg != null && importPkg != projectPkg) {
      // External package — allow bloc-related and codegen only
      if (blocAllowedPackages.contains(importPkg)) return null;
      // Other external packages — not an architecture rule, skip
      return null;
    }

    // Internal import — check layer
    final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
    if (targetLayer == null) return null;

    if (_forbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
